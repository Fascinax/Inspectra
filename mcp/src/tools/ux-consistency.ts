import { extname, basename } from "node:path";
import type { Finding } from "../types.js";
import { collectSourceFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";
import { scanFilesForColors, collectColorFindings } from "./ux-consistency-colors.js";
import { scanFilesForTypography, collectTypographyFindings } from "./ux-consistency-typography.js";
import { scanFilesForLayout, collectLayoutFindings } from "./ux-consistency-layout.js";

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

  const nextId = createIdSequence("UX");

  // Parallel scan phases
  const [colorResult, typographyResult, layoutResult] = await Promise.all([
    scanFilesForColors([...styleFiles, ...templateFiles], projectDir, isTokenDefinitionFile),
    scanFilesForTypography(styleFiles, isTokenDefinitionFile),
    scanFilesForLayout(styleFiles, templateFiles, projectDir, isTokenDefinitionFile),
  ]);

  // Collect findings from all modules
  const findings: Finding[] = [
    ...collectColorFindings(colorResult, nextId),
    ...collectTypographyFindings(typographyResult, nextId),
    ...collectLayoutFindings(layoutResult, nextId),
  ];

  return findings;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isTokenDefinitionFile(filePath: string): boolean {
  const name = basename(filePath).toLowerCase();
  return TOKEN_FILE_PATTERNS.some((p) => p.test(name));
}
