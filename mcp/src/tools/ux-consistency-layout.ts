import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import type { Finding } from "../types.js";
import type { IdGenerator } from "../utils/id.js";
import { logger } from "../logger.js";

// ─── Layout Detection Patterns ─────────────────────────────────────────────────

/** Inline style attributes in templates */
const INLINE_STYLE = /\bstyle\s*=\s*["'][^"']{10,}["']/gi;

/** Magic z-index values (>= 100) */
const MAGIC_ZINDEX = /z-index\s*:\s*(\d+)/gi;

/** Box-shadow with raw values (not using a variable/token) */
const RAW_BOX_SHADOW = /box-shadow\s*:\s*(?!var\(|none|\$|inherit|initial|unset)([^;}{]+)/gi;

/** Transition/animation duration values */
const TRANSITION_DURATION = /(?:transition(?:-duration)?|animation-duration)\s*:\s*[^;}{]*?(\d+(?:\.\d+)?m?s)/gi;

/** @media breakpoint values */
const MEDIA_BREAKPOINT = /@media[^{]*\(\s*(?:min|max)-width\s*:\s*(\d+(?:\.\d+)?(?:px|em|rem))\s*\)/gi;

/** prefers-reduced-motion query */
const REDUCED_MOTION = /prefers-reduced-motion/i;

/** @keyframes or animation property */
const HAS_ANIMATION = /@keyframes|animation\s*:/i;

const MAX_UNIQUE_SHADOWS = 5;
const MAX_UNIQUE_DURATIONS = 4;
const MAX_ZINDEX_REASONABLE = 99;
const MIN_INLINE_STYLES_FOR_FINDING = 3;

// ─── Layout Scanning ───────────────────────────────────────────────────────────

export interface LayoutScanResult {
  inlineStyleSamples: Array<{ file: string; line: number; snippet: string }>;
  inlineStyleCount: number;
  magicZindexSamples: Array<{ file: string; line: number; snippet: string }>;
  rawShadowSamples: Array<{ file: string; line: number }>;
  uniqueShadows: Set<string>;
  uniqueDurations: Set<string>;
  uniqueBreakpoints: Set<string>;
  hasAnimation: boolean;
  hasReducedMotion: boolean;
}

export async function scanFilesForLayout(
  styleFiles: string[],
  templateFiles: string[],
  projectDir: string,
  isTokenFile: (path: string) => boolean,
): Promise<LayoutScanResult> {
  const inlineStyleSamples: Array<{ file: string; line: number; snippet: string }> = [];
  let inlineStyleCount = 0;
  const magicZindexSamples: Array<{ file: string; line: number; snippet: string }> = [];
  const rawShadowSamples: Array<{ file: string; line: number }> = [];
  const uniqueShadows = new Set<string>();
  const uniqueDurations = new Set<string>();
  const uniqueBreakpoints = new Set<string>();
  let hasAnimation = false;
  let hasReducedMotion = false;

  // Scan stylesheets
  for (const filePath of styleFiles) {
    try {
      const content = await readFile(filePath, "utf-8");
      const relPath = relative(projectDir, filePath);

      if (isTokenFile(filePath)) continue;

      scanMagicZindex(content, relPath, magicZindexSamples);
      scanRawShadows(content, relPath, rawShadowSamples, uniqueShadows);
      collectDurations(content, uniqueDurations);
      collectBreakpoints(content, uniqueBreakpoints);

      if (HAS_ANIMATION.test(content)) hasAnimation = true;
      if (REDUCED_MOTION.test(content)) hasReducedMotion = true;
    } catch (error) {
      logger.error("Failed to scan stylesheet for layout", { file: filePath, error: String(error) });
    }
  }

  // Scan templates
  for (const filePath of templateFiles) {
    try {
      const content = await readFile(filePath, "utf-8");
      const relPath = relative(projectDir, filePath);

      if (isTokenFile(filePath)) continue;

      scanInlineStyles(content, relPath, inlineStyleSamples, () => inlineStyleCount++);

      if (HAS_ANIMATION.test(content)) hasAnimation = true;
      if (REDUCED_MOTION.test(content)) hasReducedMotion = true;
    } catch (error) {
      logger.error("Failed to scan template for layout", { file: filePath, error: String(error) });
    }
  }

  return {
    inlineStyleSamples,
    inlineStyleCount,
    magicZindexSamples,
    rawShadowSamples,
    uniqueShadows,
    uniqueDurations,
    uniqueBreakpoints,
    hasAnimation,
    hasReducedMotion,
  };
}

export function collectLayoutFindings(
  result: LayoutScanResult,
  nextId: IdGenerator,
): Finding[] {
  const findings: Finding[] = [];

  if (result.inlineStyleCount >= MIN_INLINE_STYLES_FOR_FINDING) {
    findings.push({
      id: nextId(),
      severity: result.inlineStyleCount >= 10 ? "high" : "medium",
      title: `${result.inlineStyleCount} inline style(s) in templates`,
      description:
        `Found ${result.inlineStyleCount} inline style attribute(s) with substantial CSS. ` +
        "Inline styles bypass the design system, are hard to maintain, and cannot be themed.",
      domain: "ux-consistency",
      rule: "inline-style-proliferation",
      confidence: 0.80,
      evidence: result.inlineStyleSamples.slice(0, 5).map(({ file, line, snippet }) => ({
        file,
        line,
        snippet: snippet.slice(0, 120),
      })),
      recommendation:
        "Move inline styles to component stylesheets or utility classes. " +
        "Use CSS custom properties for dynamic values.",
      effort: "small",
      tags: ["nielsen:H4"],
      source: "tool",
    });
  }

  if (result.magicZindexSamples.length > 0) {
    findings.push({
      id: nextId(),
      severity: "medium",
      title: `${result.magicZindexSamples.length} magic z-index value(s) detected`,
      description:
        "Found z-index values over 99 that appear to be arbitrary magic numbers. " +
        "Unmanaged z-index values cause stacking context wars and unpredictable layering.",
      domain: "ux-consistency",
      rule: "magic-zindex",
      confidence: 0.85,
      evidence: result.magicZindexSamples.slice(0, 5).map(({ file, line, snippet }) => ({
        file,
        line,
        snippet: snippet.slice(0, 120),
      })),
      recommendation:
        "Define a z-index scale as design tokens (e.g., --z-dropdown: 10, --z-modal: 20, --z-toast: 30) " +
        "and replace raw numbers.",
      effort: "small",
      tags: ["nielsen:H4", "dtcg:number"],
      source: "tool",
    });
  }

  if (result.uniqueShadows.size > MAX_UNIQUE_SHADOWS) {
    findings.push({
      id: nextId(),
      severity: "medium",
      title: `${result.uniqueShadows.size} distinct box-shadow definitions (expected ≤ ${MAX_UNIQUE_SHADOWS})`,
      description:
        `Found ${result.uniqueShadows.size} unique box-shadow values. A consistent elevation system typically uses 3–5 levels. ` +
        "Shadow sprawl indicates missing elevation tokens.",
      domain: "ux-consistency",
      rule: "shadow-sprawl",
      confidence: 0.80,
      evidence: result.rawShadowSamples.slice(0, 3),
      recommendation:
        "Define elevation tokens (--shadow-sm, --shadow-md, --shadow-lg) and replace raw box-shadow declarations.",
      effort: "small",
      tags: ["nielsen:H4", "dtcg:shadow", "dsc:foundations-elevation"],
      source: "tool",
    });
  }

  if (result.uniqueDurations.size > MAX_UNIQUE_DURATIONS) {
    findings.push({
      id: nextId(),
      severity: "low",
      title: `${result.uniqueDurations.size} distinct transition durations (expected ≤ ${MAX_UNIQUE_DURATIONS})`,
      description:
        `Found ${result.uniqueDurations.size} unique transition/animation duration values: ${[...result.uniqueDurations].slice(0, 6).join(", ")}. ` +
        "Inconsistent timing makes the UI feel incoherent.",
      domain: "ux-consistency",
      rule: "inconsistent-durations",
      confidence: 0.80,
      evidence: [{ file: "." }],
      recommendation:
        "Define 2–4 duration tokens (--duration-fast: 150ms, --duration-normal: 300ms, --duration-slow: 500ms) " +
        "and use them consistently.",
      effort: "trivial",
      tags: ["nielsen:H4", "dtcg:duration", "dsc:foundations-motion"],
      source: "tool",
    });
  }

  if (result.hasAnimation && !result.hasReducedMotion) {
    findings.push({
      id: nextId(),
      severity: "medium",
      title: "Animations detected without prefers-reduced-motion support",
      description:
        "The project uses CSS animations or transitions but no @media (prefers-reduced-motion) query was found. " +
        "Users with vestibular disorders may experience discomfort.",
      domain: "ux-consistency",
      rule: "missing-reduced-motion",
      confidence: 0.85,
      evidence: [{ file: "." }],
      recommendation:
        "Add @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; } } " +
        "as a global safety net.",
      effort: "trivial",
      tags: ["nielsen:H4", "dsc:foundations-motion"],
      source: "tool",
    });
  }

  if (result.uniqueBreakpoints.size > 5) {
    findings.push({
      id: nextId(),
      severity: "low",
      title: `${result.uniqueBreakpoints.size} distinct media query breakpoints`,
      description:
        `Found ${result.uniqueBreakpoints.size} unique breakpoint values in @media queries: ${[...result.uniqueBreakpoints].slice(0, 6).join(", ")}. ` +
        "Non-standard breakpoints create inconsistent responsive behavior.",
      domain: "ux-consistency",
      rule: "breakpoint-inconsistency",
      confidence: 0.80,
      evidence: [{ file: "." }],
      recommendation:
        "Standardize on 3–5 breakpoints (e.g., sm: 640px, md: 768px, lg: 1024px, xl: 1280px) " +
        "and define them as design tokens.",
      effort: "small",
      tags: ["nielsen:H4", "dsc:foundations-layout"],
      source: "tool",
    });
  }

  return findings;
}

// ─── Internal Helpers ──────────────────────────────────────────────────────────

function scanInlineStyles(
  content: string,
  relPath: string,
  samples: Array<{ file: string; line: number; snippet: string }>,
  increment: () => void,
): void {
  INLINE_STYLE.lastIndex = 0;
  for (const m of content.matchAll(INLINE_STYLE)) {
    increment();
    if (samples.length < 5) {
      samples.push({
        file: relPath,
        line: lineOf(content, m.index ?? 0),
        snippet: m[0],
      });
    }
  }
}

function scanMagicZindex(
  content: string,
  relPath: string,
  samples: Array<{ file: string; line: number; snippet: string }>,
): void {
  MAGIC_ZINDEX.lastIndex = 0;
  for (const m of content.matchAll(MAGIC_ZINDEX)) {
    const value = parseInt(m[1] ?? "0", 10);
    if (value > MAX_ZINDEX_REASONABLE && samples.length < 5) {
      samples.push({
        file: relPath,
        line: lineOf(content, m.index ?? 0),
        snippet: m[0],
      });
    }
  }
}

function scanRawShadows(
  content: string,
  relPath: string,
  samples: Array<{ file: string; line: number }>,
  uniqueShadows: Set<string>,
): void {
  RAW_BOX_SHADOW.lastIndex = 0;
  for (const m of content.matchAll(RAW_BOX_SHADOW)) {
    const shadowValue = (m[1] ?? "").trim();
    if (shadowValue) {
      uniqueShadows.add(shadowValue);
      if (samples.length < 5) {
        samples.push({ file: relPath, line: lineOf(content, m.index ?? 0) });
      }
    }
  }
}

function collectDurations(content: string, durations: Set<string>): void {
  TRANSITION_DURATION.lastIndex = 0;
  for (const m of content.matchAll(TRANSITION_DURATION)) {
    durations.add((m[1] ?? "").toLowerCase());
  }
}

function collectBreakpoints(content: string, breakpoints: Set<string>): void {
  MEDIA_BREAKPOINT.lastIndex = 0;
  for (const m of content.matchAll(MEDIA_BREAKPOINT)) {
    breakpoints.add((m[1] ?? "").toLowerCase());
  }
}

function lineOf(content: string, charIndex: number): number {
  return content.slice(0, charIndex).split("\n").length;
}
