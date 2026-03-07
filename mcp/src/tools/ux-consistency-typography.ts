import { readFile } from "node:fs/promises";
import type { Finding } from "../types.js";
import type { IdGenerator } from "../utils/id.js";
import { logger } from "../logger.js";

// ─── Typography Detection Patterns ─────────────────────────────────────────────

/** Font-family declarations */
const FONT_FAMILY = /font-family\s*:\s*([^;}{]+)/gi;

/** Font-size with raw px/rem/em values */
const RAW_FONT_SIZE = /font-size\s*:\s*(\d+(?:\.\d+)?(?:px|rem|em))/gi;

const MAX_UNIQUE_FONT_FAMILIES = 3;
const MAX_UNIQUE_FONT_SIZES = 10;

// ─── Typography Scanning ───────────────────────────────────────────────────────

export interface TypographyScanResult {
  uniqueFontFamilies: Set<string>;
  uniqueFontSizes: Set<string>;
}

export async function scanFilesForTypography(
  files: string[],
  isTokenFile: (path: string) => boolean,
): Promise<TypographyScanResult> {
  const uniqueFontFamilies = new Set<string>();
  const uniqueFontSizes = new Set<string>();

  for (const filePath of files) {
    try {
      const content = await readFile(filePath, "utf-8");

      if (isTokenFile(filePath)) continue;

      collectFontFamilies(content, uniqueFontFamilies);
      collectFontSizes(content, uniqueFontSizes);
    } catch (error) {
      logger.error("Failed to scan file for typography", { file: filePath, error: String(error) });
    }
  }

  return { uniqueFontFamilies, uniqueFontSizes };
}

export function collectTypographyFindings(
  result: TypographyScanResult,
  nextId: IdGenerator,
): Finding[] {
  const findings: Finding[] = [];

  if (result.uniqueFontFamilies.size > MAX_UNIQUE_FONT_FAMILIES) {
    findings.push({
      id: nextId(),
      severity: "medium",
      title: `${result.uniqueFontFamilies.size} distinct font families (expected ≤ ${MAX_UNIQUE_FONT_FAMILIES})`,
      description:
        `Found ${result.uniqueFontFamilies.size} unique font-family declarations: ${[...result.uniqueFontFamilies].slice(0, 5).join(", ")}. ` +
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

  if (result.uniqueFontSizes.size > MAX_UNIQUE_FONT_SIZES) {
    findings.push({
      id: nextId(),
      severity: "medium",
      title: `${result.uniqueFontSizes.size} distinct font sizes (expected ≤ ${MAX_UNIQUE_FONT_SIZES})`,
      description:
        `Found ${result.uniqueFontSizes.size} unique font-size values. A consistent type scale typically uses 8–10 steps. ` +
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

  return findings;
}

// ─── Internal Helpers ──────────────────────────────────────────────────────────

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
