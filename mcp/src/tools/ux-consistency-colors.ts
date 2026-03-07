import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import type { Finding } from "../types.js";
import type { IdGenerator } from "../utils/id.js";
import { logger } from "../logger.js";

// ─── Color Detection Patterns ─────────────────────────────────────────────────

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

const MIN_HARDCODED_COLORS_FOR_FINDING = 5;

// ─── Color Scanning ────────────────────────────────────────────────────────────

export interface ColorScanResult {
  samples: Array<{ file: string; line: number }>;
  count: number;
}

export async function scanFilesForColors(
  files: string[],
  projectDir: string,
  isTokenFile: (path: string) => boolean,
): Promise<ColorScanResult> {
  const samples: Array<{ file: string; line: number }> = [];
  let count = 0;

  for (const filePath of files) {
    try {
      const content = await readFile(filePath, "utf-8");
      const relPath = relative(projectDir, filePath);

      if (isTokenFile(filePath)) continue;

      scanHardcodedColors(content, relPath, samples, () => count++);
    } catch (error) {
      logger.error("Failed to scan file for colors", { file: filePath, error: String(error) });
    }
  }

  return { samples, count };
}

export function collectColorFindings(
  result: ColorScanResult,
  nextId: IdGenerator,
): Finding[] {
  const findings: Finding[] = [];

  if (result.count >= MIN_HARDCODED_COLORS_FOR_FINDING) {
    findings.push({
      id: nextId(),
      severity: result.count >= 20 ? "high" : "medium",
      title: `${result.count} hardcoded color value(s) instead of design tokens`,
      description:
        `Found ${result.count} hardcoded color values (hex, rgb, hsl) outside token/variable definition files. ` +
        "Hardcoded colors make theme changes expensive and drift from the design system palette.",
      domain: "ux-consistency",
      rule: "hardcoded-color",
      confidence: 0.85,
      evidence: result.samples.slice(0, 5),
      recommendation:
        "Replace raw color values with CSS custom properties (var(--color-primary)), SCSS variables ($color-primary), " +
        "or Tailwind utility classes. Define all colors in a central token file.",
      effort: "medium",
      tags: ["nielsen:H4", "dtcg:color", "dsc:foundations-color"],
      source: "tool",
    });
  }

  return findings;
}

// ─── Internal Helpers ──────────────────────────────────────────────────────────

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

function lineOf(content: string, charIndex: number): number {
  return content.slice(0, charIndex).split("\n").length;
}
