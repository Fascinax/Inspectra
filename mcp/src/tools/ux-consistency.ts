import { readFile } from "node:fs/promises";
import { relative, extname, basename } from "node:path";
import type { Finding } from "../types.js";
import { collectSourceFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";

// ─── File extensions ──────────────────────────────────────────────────────────

const STYLE_EXTENSIONS = [".css", ".scss", ".less"];
const TEMPLATE_EXTENSIONS = [".html", ".jsx", ".tsx"];
const TOKEN_FILE_PATTERNS = [
  /variables\.(css|scss|less)$/,
  /tokens?\.(css|scss|less|json|ts|js)$/,
  /theme\.(ts|js|css|scss)$/,
  /design-tokens/,
  /tailwind\.config/,
];

// ─── Detection patterns ──────────────────────────────────────────────────────

/** Hardcoded hex color values (3, 4, 6, or 8 digit) */
const HEX_COLOR = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/g;
/** RGB/RGBA/HSL/HSLA function calls */
const FUNCTIONAL_COLOR = /(?:rgba?|hsla?)\s*\([^)]+\)/gi;
/** CSS custom property usage (--var-name) — these are OK */
const CSS_VAR_USAGE = /var\(\s*--[a-z0-9-]+/gi;
/** CSS custom property definition */
const CSS_VAR_DEFINITION = /--[a-z][a-z0-9-]*\s*:/gi;
/** SCSS variable usage ($var-name) — these are OK */
const SCSS_VAR_USAGE = /\$[a-z][a-z0-9_-]*/gi;

/** Inline style attributes in templates */
const INLINE_STYLE = /\bstyle\s*=\s*["'][^"']{10,}["']/gi;

/** Magic z-index values (>= 100) */
const MAGIC_ZINDEX = /z-index\s*:\s*(\d+)/gi;

/** Box-shadow with raw values (not using a variable/token) */
const RAW_BOX_SHADOW = /box-shadow\s*:\s*(?!var\(|none|\$|inherit|initial|unset)([^;}{]+)/gi;

/** Font-family declarations */
const FONT_FAMILY = /font-family\s*:\s*([^;}{]+)/gi;

/** Font-size with raw px/rem/em values */
const RAW_FONT_SIZE = /font-size\s*:\s*(\d+(?:\.\d+)?(?:px|rem|em))/gi;

/** Transition/animation duration values */
const TRANSITION_DURATION = /(?:transition(?:-duration)?|animation-duration)\s*:\s*[^;}{]*?(\d+(?:\.\d+)?m?s)/gi;

/** @media breakpoint values */
const MEDIA_BREAKPOINT = /@media[^{]*\(\s*(?:min|max)-width\s*:\s*(\d+(?:\.\d+)?(?:px|em|rem))\s*\)/gi;

/** prefers-reduced-motion query */
const REDUCED_MOTION = /prefers-reduced-motion/i;
/** @keyframes or animation property */
const HAS_ANIMATION = /@keyframes|animation\s*:/i;

// ─── Thresholds ──────────────────────────────────────────────────────────────

const MAX_UNIQUE_FONT_FAMILIES = 3;
const MAX_UNIQUE_FONT_SIZES = 10;
const MAX_UNIQUE_SHADOWS = 5;
const MAX_UNIQUE_DURATIONS = 4;
const MIN_HARDCODED_COLORS_FOR_FINDING = 5;
const MAX_ZINDEX_REASONABLE = 99;
const MIN_INLINE_STYLES_FOR_FINDING = 3;

/**
 * Scans stylesheets and templates for design system consistency violations.
 *
 * Detects:
 * - Hardcoded color values instead of design tokens / CSS variables
 * - Inline style proliferation in templates
 * - Magic z-index values
 * - Raw box-shadow definitions (not using tokens)
 * - Font family proliferation
 * - Font size sprawl (too many unique sizes)
 * - Inconsistent transition durations
 * - Missing prefers-reduced-motion when animations are used
 * - Breakpoint inconsistency across media queries
 */
export async function checkUxConsistency(
  projectDir: string,
  ignoreDirs?: string[],
): Promise<Finding[]> {
  const allExtensions = [...STYLE_EXTENSIONS, ...TEMPLATE_EXTENSIONS];
  const files = await collectSourceFiles(projectDir, allExtensions, ignoreDirs);

  const styleFiles = files.filter((f) => STYLE_EXTENSIONS.includes(extname(f)));
  const templateFiles = files.filter((f) => TEMPLATE_EXTENSIONS.includes(extname(f)));

  const findings: Finding[] = [];
  const nextId = createIdSequence("UX");

  // Accumulators
  const hardcodedColorSamples: Array<{ file: string; line: number }> = [];
  let hardcodedColorCount = 0;
  const inlineStyleSamples: Array<{ file: string; line: number; snippet: string }> = [];
  let inlineStyleCount = 0;
  const magicZindexSamples: Array<{ file: string; line: number; snippet: string }> = [];
  const rawShadowSamples: Array<{ file: string; line: number }> = [];
  const uniqueFontFamilies = new Set<string>();
  const uniqueFontSizes = new Set<string>();
  const uniqueShadows = new Set<string>();
  const uniqueDurations = new Set<string>();
  const uniqueBreakpoints = new Set<string>();
  let hasAnimation = false;
  let hasReducedMotion = false;

  // ── Scan stylesheets ────────────────────────────────────────────────────
  for (const filePath of styleFiles) {
    try {
      const content = await readFile(filePath, "utf-8");
      const relPath = relative(projectDir, filePath);

      if (isTokenDefinitionFile(filePath)) continue;

      scanHardcodedColors(content, relPath, hardcodedColorSamples, () => hardcodedColorCount++);
      scanMagicZindex(content, relPath, magicZindexSamples);
      scanRawShadows(content, relPath, rawShadowSamples, uniqueShadows);
      collectFontFamilies(content, uniqueFontFamilies);
      collectFontSizes(content, uniqueFontSizes);
      collectDurations(content, uniqueDurations);
      collectBreakpoints(content, uniqueBreakpoints);

      if (HAS_ANIMATION.test(content)) hasAnimation = true;
      if (REDUCED_MOTION.test(content)) hasReducedMotion = true;
    } catch {
      /* skip unreadable files */
    }
  }

  // ── Scan templates for inline styles ────────────────────────────────────
  for (const filePath of templateFiles) {
    try {
      const content = await readFile(filePath, "utf-8");
      const relPath = relative(projectDir, filePath);

      if (isTokenDefinitionFile(filePath)) continue;

      scanInlineStyles(content, relPath, inlineStyleSamples, () => inlineStyleCount++);

      // Also scan for hardcoded colors in templates (inline styles or CSS-in-JS)
      scanHardcodedColors(content, relPath, hardcodedColorSamples, () => hardcodedColorCount++);

      if (HAS_ANIMATION.test(content)) hasAnimation = true;
      if (REDUCED_MOTION.test(content)) hasReducedMotion = true;
    } catch {
      /* skip unreadable files */
    }
  }

  // ── Emit findings ──────────────────────────────────────────────────────

  if (hardcodedColorCount >= MIN_HARDCODED_COLORS_FOR_FINDING) {
    findings.push({
      id: nextId(),
      severity: hardcodedColorCount >= 20 ? "high" : "medium",
      title: `${hardcodedColorCount} hardcoded color value(s) instead of design tokens`,
      description:
        `Found ${hardcodedColorCount} hardcoded color values (hex, rgb, hsl) outside token/variable definition files. ` +
        "Hardcoded colors make theme changes expensive and drift from the design system palette.",
      domain: "ux-consistency",
      rule: "hardcoded-color",
      confidence: 0.85,
      evidence: hardcodedColorSamples.slice(0, 5),
      recommendation:
        "Replace raw color values with CSS custom properties (var(--color-primary)), SCSS variables ($color-primary), " +
        "or Tailwind utility classes. Define all colors in a central token file.",
      effort: "medium",
      tags: ["nielsen:H4", "dtcg:color", "dsc:foundations-color"],
      source: "tool",
    });
  }

  if (inlineStyleCount >= MIN_INLINE_STYLES_FOR_FINDING) {
    findings.push({
      id: nextId(),
      severity: inlineStyleCount >= 10 ? "high" : "medium",
      title: `${inlineStyleCount} inline style(s) in templates`,
      description:
        `Found ${inlineStyleCount} inline style attribute(s) with substantial CSS. ` +
        "Inline styles bypass the design system, are hard to maintain, and cannot be themed.",
      domain: "ux-consistency",
      rule: "inline-style-proliferation",
      confidence: 0.80,
      evidence: inlineStyleSamples.slice(0, 5).map(({ file, line, snippet }) => ({
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

  if (magicZindexSamples.length > 0) {
    findings.push({
      id: nextId(),
      severity: "medium",
      title: `${magicZindexSamples.length} magic z-index value(s) detected`,
      description:
        "Found z-index values over 99 that appear to be arbitrary magic numbers. " +
        "Unmanaged z-index values cause stacking context wars and unpredictable layering.",
      domain: "ux-consistency",
      rule: "magic-zindex",
      confidence: 0.85,
      evidence: magicZindexSamples.slice(0, 5).map(({ file, line, snippet }) => ({
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

  if (uniqueShadows.size > MAX_UNIQUE_SHADOWS) {
    findings.push({
      id: nextId(),
      severity: "medium",
      title: `${uniqueShadows.size} distinct box-shadow definitions (expected ≤ ${MAX_UNIQUE_SHADOWS})`,
      description:
        `Found ${uniqueShadows.size} unique box-shadow values. A consistent elevation system typically uses 3–5 levels. ` +
        "Shadow sprawl indicates missing elevation tokens.",
      domain: "ux-consistency",
      rule: "shadow-sprawl",
      confidence: 0.80,
      evidence: rawShadowSamples.slice(0, 3),
      recommendation:
        "Define elevation tokens (--shadow-sm, --shadow-md, --shadow-lg) and replace raw box-shadow declarations.",
      effort: "small",
      tags: ["nielsen:H4", "dtcg:shadow", "dsc:foundations-elevation"],
      source: "tool",
    });
  }

  if (uniqueFontFamilies.size > MAX_UNIQUE_FONT_FAMILIES) {
    findings.push({
      id: nextId(),
      severity: "medium",
      title: `${uniqueFontFamilies.size} distinct font families (expected ≤ ${MAX_UNIQUE_FONT_FAMILIES})`,
      description:
        `Found ${uniqueFontFamilies.size} unique font-family declarations: ${[...uniqueFontFamilies].slice(0, 5).join(", ")}. ` +
        "Using too many typefaces breaks visual cohesion.",
      domain: "ux-consistency",
      rule: "font-family-proliferation",
      confidence: 0.85,
      evidence: [{ file: "." }],
      recommendation:
        "Consolidate to 2–3 font families (primary, monospace, optional display) defined as design tokens.",
      effort: "small",
      tags: ["nielsen:H4", "dtcg:fontFamily", "dsc:foundations-typography"],
      source: "tool",
    });
  }

  if (uniqueFontSizes.size > MAX_UNIQUE_FONT_SIZES) {
    findings.push({
      id: nextId(),
      severity: "medium",
      title: `${uniqueFontSizes.size} distinct font sizes (expected ≤ ${MAX_UNIQUE_FONT_SIZES})`,
      description:
        `Found ${uniqueFontSizes.size} unique font-size values. A consistent type scale typically uses 8–10 steps. ` +
        "Size sprawl indicates missing typography tokens.",
      domain: "ux-consistency",
      rule: "font-size-sprawl",
      confidence: 0.80,
      evidence: [{ file: "." }],
      recommendation:
        "Define a type scale (e.g., 12, 14, 16, 18, 20, 24, 30, 36, 48px) as design tokens " +
        "and replace raw font-size values.",
      effort: "medium",
      tags: ["nielsen:H4", "dtcg:typography", "dsc:foundations-typography"],
      source: "tool",
    });
  }

  if (uniqueDurations.size > MAX_UNIQUE_DURATIONS) {
    findings.push({
      id: nextId(),
      severity: "low",
      title: `${uniqueDurations.size} distinct transition durations (expected ≤ ${MAX_UNIQUE_DURATIONS})`,
      description:
        `Found ${uniqueDurations.size} unique transition/animation duration values: ${[...uniqueDurations].slice(0, 6).join(", ")}. ` +
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

  if (hasAnimation && !hasReducedMotion) {
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

  if (uniqueBreakpoints.size > 5) {
    findings.push({
      id: nextId(),
      severity: "low",
      title: `${uniqueBreakpoints.size} distinct media query breakpoints`,
      description:
        `Found ${uniqueBreakpoints.size} unique breakpoint values in @media queries: ${[...uniqueBreakpoints].slice(0, 6).join(", ")}. ` +
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

// ─── Scan helpers ─────────────────────────────────────────────────────────────

function isTokenDefinitionFile(filePath: string): boolean {
  const name = basename(filePath).toLowerCase();
  return TOKEN_FILE_PATTERNS.some((p) => p.test(name));
}

function scanHardcodedColors(
  content: string,
  relPath: string,
  samples: Array<{ file: string; line: number }>,
  increment: () => void,
): void {
  // Count CSS var and SCSS var usages to determine if the file already uses tokens
  const varUsageCount =
    (content.match(CSS_VAR_USAGE) ?? []).length +
    (content.match(SCSS_VAR_USAGE) ?? []).length;
  const varDefinitionCount = (content.match(CSS_VAR_DEFINITION) ?? []).length;

  // Scan for hex colors
  HEX_COLOR.lastIndex = 0;
  for (const m of content.matchAll(HEX_COLOR)) {
    // Skip colors inside variable definitions
    const lineStart = content.lastIndexOf("\n", (m.index ?? 0)) + 1;
    const lineTxt = content.slice(lineStart, (m.index ?? 0) + m[0].length + 50);
    if (/^\s*--[a-z]|^\s*\$[a-z]/i.test(lineTxt)) continue;
    // Skip common non-visual hex patterns (#region, #pragma, etc.)
    if (/^#(?:region|pragma|if|else|end|include)/i.test(m[0])) continue;
    // Skip black and white (very common, often intentional)
    const normalized = m[0].toLowerCase();
    if (normalized === "#000" || normalized === "#000000" || normalized === "#fff" || normalized === "#ffffff") continue;

    increment();
    if (samples.length < 5) {
      samples.push({ file: relPath, line: lineOf(content, m.index ?? 0) });
    }
  }

  // Scan for rgb/hsl functions (only if file does NOT primarily use vars)
  if (varUsageCount < varDefinitionCount + 3) {
    FUNCTIONAL_COLOR.lastIndex = 0;
    for (const m of content.matchAll(FUNCTIONAL_COLOR)) {
      const lineStart = content.lastIndexOf("\n", (m.index ?? 0)) + 1;
      const lineTxt = content.slice(lineStart, (m.index ?? 0) + m[0].length + 50);
      if (/^\s*--[a-z]|^\s*\$[a-z]/i.test(lineTxt)) continue;

      increment();
      if (samples.length < 5) {
        samples.push({ file: relPath, line: lineOf(content, m.index ?? 0) });
      }
    }
  }
}

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

function collectFontFamilies(content: string, families: Set<string>): void {
  FONT_FAMILY.lastIndex = 0;
  for (const m of content.matchAll(FONT_FAMILY)) {
    const primary = (m[1] ?? "").split(",")[0]?.trim().replace(/["']/g, "");
    if (primary && primary.length > 1 && !/^(?:inherit|initial|unset|var\()/.test(primary)) {
      families.add(primary.toLowerCase());
    }
  }
}

function collectFontSizes(content: string, sizes: Set<string>): void {
  RAW_FONT_SIZE.lastIndex = 0;
  for (const m of content.matchAll(RAW_FONT_SIZE)) {
    sizes.add((m[1] ?? "").toLowerCase());
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
