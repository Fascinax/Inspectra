import { readFile } from "node:fs/promises";
import { relative, extname } from "node:path";
import type { Finding } from "../types.js";
import { collectAllFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";

/** HTML/Angular component templates and JSX/TSX files */
const TEMPLATE_EXTENSIONS = new Set([".html", ".tsx", ".jsx"]);
/** Angular component .ts files (may contain inline templates) */
const COMPONENT_TS_PATTERN = /\.component\.ts$/;

/** <img> tag without alt attribute (or empty alt that isn't intentionally decorative) */
const IMG_NO_ALT = /<img(?![^>]*\balt\s*=)[^>]*>/gi;

/** <button> / <a> / clickable <div role="button"> with no text and no aria-label */
const INTERACTIVE_NO_LABEL =
  /<(button|a)(?![^>]*(?:aria-label|aria-labelledby|title)\s*=)[^>]*>\s*<\/\1>/gi;

/** <html> root tag without lang attribute — accessibility requirement */
const HTML_NO_LANG = /<html(?![^>]*\blang\s*=)[^>]*>/i;

/** <input> without an associated <label>, [aria-label], or [aria-labelledby] */
const INPUT_NO_LABEL =
  /<input(?![^>]*(?:aria-label|aria-labelledby|type\s*=\s*["']hidden["']))[^>]*>/gi;

/** Angular inline template: template: `...` */
const ANGULAR_INLINE_TEMPLATE = /template\s*:\s*`([\s\S]*?)`/;

/**
 * Scans HTML templates and JSX/TSX files for common accessibility violations.
 *
 * Detects:
 * - Images without alt text
 * - Interactive elements (button/a) with no accessible name
 * - Root <html> element without lang attribute
 * - Form inputs without ARIA labels
 */
export async function checkA11yTemplates(projectDir: string): Promise<Finding[]> {
  const files = await collectAllFiles(projectDir);
  const targetFiles = files.filter(
    (f) => TEMPLATE_EXTENSIONS.has(extname(f)) || COMPONENT_TS_PATTERN.test(f),
  );

  const findings: Finding[] = [];
  const nextId = createIdSequence("ACC");

  for (const filePath of targetFiles) {
    try {
      let content = await readFile(filePath, "utf-8");
      const relPath = relative(projectDir, filePath);

      // For Angular .component.ts files, extract inline template if present
      if (COMPONENT_TS_PATTERN.test(filePath)) {
        const match = ANGULAR_INLINE_TEMPLATE.exec(content);
        if (!match) continue; // no inline template, skip
        content = match[1] ?? "";
      }

      // ── img without alt ───────────────────────────────────────────────────
      IMG_NO_ALT.lastIndex = 0;
      const imgMatches = [...content.matchAll(IMG_NO_ALT)];
      for (const m of imgMatches.slice(0, 3)) {
        const line = lineOf(content, m.index ?? 0);
        findings.push({
          id: nextId(),
          severity: "medium",
          title: `Image missing alt attribute: ${relPath}`,
          description:
            "An <img> element has no alt attribute. Screen readers cannot describe this image to visually impaired users. " +
            "Use alt=\"\" for decorative images or a descriptive text for informational ones.",
          domain: "accessibility",
          rule: "img-missing-alt",
          confidence: 0.90,
          evidence: [{ file: relPath, line, snippet: m[0].slice(0, 120) }],
          recommendation: 'Add alt="" for decorative images or a meaningful description for informational images.',
          effort: "trivial",
          tags: ["a11y", "wcag", "images"],
          source: "tool",
        });
      }

      // ── interactive elements without accessible name ───────────────────────
      INTERACTIVE_NO_LABEL.lastIndex = 0;
      const interactiveMatches = [...content.matchAll(INTERACTIVE_NO_LABEL)];
      for (const m of interactiveMatches.slice(0, 3)) {
        const line = lineOf(content, m.index ?? 0);
        findings.push({
          id: nextId(),
          severity: "high",
          title: `Interactive element without accessible name: ${relPath}`,
          description:
            `An empty <${m[1]}> element has no inner text, aria-label, or aria-labelledby. ` +
            "Screen readers cannot announce its purpose.",
          domain: "accessibility",
          rule: "interactive-no-accessible-name",
          confidence: 0.85,
          evidence: [{ file: relPath, line, snippet: m[0].slice(0, 120) }],
          recommendation: "Add an aria-label attribute or visible text content to the element.",
          effort: "trivial",
          tags: ["a11y", "wcag", "interactive"],
          source: "tool",
        });
      }

      // ── <html> without lang ───────────────────────────────────────────────
      if (extname(filePath) === ".html" && HTML_NO_LANG.test(content)) {
        findings.push({
          id: nextId(),
          severity: "medium",
          title: `Root <html> element missing lang attribute: ${relPath}`,
          description:
            "The <html> element does not declare a language. Screen readers use the lang attribute " +
            "to select the correct pronunciation engine.",
          domain: "accessibility",
          rule: "html-missing-lang",
          confidence: 0.95,
          evidence: [{ file: relPath, line: 1 }],
          recommendation: 'Add lang="en" (or the appropriate BCP 47 language tag) to the <html> element.',
          effort: "trivial",
          tags: ["a11y", "wcag", "language"],
          source: "tool",
        });
      }

      // ── form inputs without ARIA label ────────────────────────────────────
      INPUT_NO_LABEL.lastIndex = 0;
      const inputMatches = [...content.matchAll(INPUT_NO_LABEL)];
      if (inputMatches.length >= 2) {
        findings.push({
          id: nextId(),
          severity: "medium",
          title: `Form inputs without accessible labels: ${relPath}`,
          description:
            `Found ${inputMatches.length} <input> element(s) without aria-label or aria-labelledby. ` +
            "Unlabelled form controls are inaccessible to screen reader users.",
          domain: "accessibility",
          rule: "input-missing-label",
          confidence: 0.75,
          evidence: [{ file: relPath, line: lineOf(content, inputMatches[0]?.index ?? 0) }],
          recommendation: "Add a <label for='...'>  or aria-label / aria-labelledby attribute to each input.",
          effort: "small",
          tags: ["a11y", "wcag", "forms"],
          source: "tool",
        });
      }
    } catch {
      /* skip unreadable files */
    }
  }

  return findings;
}

function lineOf(content: string, charIndex: number): number {
  return content.slice(0, charIndex).split("\n").length;
}
