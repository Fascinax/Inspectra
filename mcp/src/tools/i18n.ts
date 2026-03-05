import { readFile } from "node:fs/promises";
import { relative, extname } from "node:path";
import type { Finding } from "../types.js";
import { collectSourceFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";

// ─── Patterns ─────────────────────────────────────────────────────────────────

/** Angular i18n pipe: {{ 'key' | translate }} or {{ text | i18nSelect }} etc. */
const ANGULAR_I18N_PIPE = /\|\s*(?:translate|i18nSelect|i18nPlural|async)/;

/** Angular i18n attribute: i18n, i18n-placeholder, etc. */
const ANGULAR_I18N_ATTR = /\bi18n(?:-[a-z]+)?\b/;

/** React i18n usage patterns: t('key'), i18n.t(...), useTranslation, FormattedMessage */
const REACT_I18N = /(?:\bt\s*\(|i18n\.t\s*\(|useTranslation|<FormattedMessage|intl\.formatMessage)/;

/** Hardcoded user-visible string in template: text content between tags, not a variable */
const TEMPLATE_TEXT_CONTENT =
  />([^<{}\n]{4,80})</g;

/** Filter out strings that are clearly not user-facing */
const IGNORE_PATTERN =
  /^[\s\d\-_./\\@#%^*+=|<>{}[\]()!?,;:'"`~&$]+$|^(?:true|false|null|undefined|NaN|Infinity|class|function|import|export|const|let|var|if|else|for|while|return|void|type|interface|enum)$/i;

const TEMPLATE_EXTENSIONS = [".html", ".jsx", ".tsx"];
const SOURCE_EXTENSIONS = [".ts", ".js"];

/**
 * Scans template and source files for i18n issues:
 * - Hardcoded user-facing strings in templates (not wrapped in i18n pipe/attribute)
 * - Missing i18n configuration file
 * - Angular templates using text without i18n attribute
 */
export async function checkI18n(projectDir: string): Promise<Finding[]> {
  const allFiles = await collectSourceFiles(projectDir, [...TEMPLATE_EXTENSIONS, ...SOURCE_EXTENSIONS]);

  const templateFiles = allFiles.filter((f) => TEMPLATE_EXTENSIONS.includes(extname(f)));
  const sourceFiles = allFiles.filter((f) => SOURCE_EXTENSIONS.includes(extname(f)));

  const findings: Finding[] = [];
  const nextId = createIdSequence("INT");

  let hasI18nLib = false;
  let hardcodedCount = 0;
  const hardcodedSamples: Array<{ file: string; line: number }> = [];

  // Check source files for any i18n library usage
  for (const filePath of sourceFiles) {
    try {
      const content = await readFile(filePath, "utf-8");
      if (REACT_I18N.test(content) || /(?:ngx-translate|@ngx-translate|TranslateModule|i18next|react-intl|react-i18next|vue-i18n|format\.js)/.test(content)) {
        hasI18nLib = true;
        break;
      }
    } catch {
      /* skip */
    }
  }

  // Check template files for hardcoded text
  for (const filePath of templateFiles) {
    try {
      const content = await readFile(filePath, "utf-8");
      const relPath = relative(projectDir, filePath);

      const hasI18nInFile = ANGULAR_I18N_PIPE.test(content) || ANGULAR_I18N_ATTR.test(content) || REACT_I18N.test(content);

      // Only flag hardcoded strings if the codebase shows i18n adoption elsewhere
      if (hasI18nLib || hasI18nInFile) {
        TEMPLATE_TEXT_CONTENT.lastIndex = 0;
        for (const m of content.matchAll(TEMPLATE_TEXT_CONTENT)) {
          const text = (m[1] ?? "").trim();
          if (text.length >= 4 && !IGNORE_PATTERN.test(text) && isLikelyUserFacing(text)) {
            hardcodedCount++;
            if (hardcodedSamples.length < 5) {
              hardcodedSamples.push({
                file: relPath,
                line: content.slice(0, m.index ?? 0).split("\n").length,
              });
            }
          }
        }
      }
    } catch {
      /* skip */
    }
  }

  if (hardcodedCount >= 3) {
    findings.push({
      id: nextId(),
      severity: "medium",
      title: `${hardcodedCount} hardcoded user-facing string(s) in templates`,
      description:
        `Found ${hardcodedCount} template text node(s) that appear to be user-facing strings not wrapped in an i18n mechanism. ` +
        "Hardcoded strings block localization and make copy changes require code deployments.",
      domain: "i18n",
      rule: "hardcoded-template-string",
      confidence: 0.75,
      evidence: hardcodedSamples,
      recommendation:
        "Wrap user-visible text with your i18n solution: {{ 'key' | translate }} for Angular/ngx-translate, " +
        "{t('key')} for React/i18next, or add the i18n attribute for Angular's built-in i18n.",
      effort: "medium",
      tags: ["i18n", "localization", "templates"],
      source: "tool",
    });
  }

  // No i18n lib at all
  if (!hasI18nLib && sourceFiles.length >= 5) {
    findings.push({
      id: nextId(),
      severity: "low",
      title: "No i18n library detected",
      description:
        "No internationalization library (ngx-translate, react-i18next, vue-i18n, i18next, react-intl) was detected in the codebase. " +
        "Adding i18n early is significantly cheaper than retrofitting later.",
      domain: "i18n",
      rule: "missing-i18n-library",
      confidence: 0.80,
      evidence: [{ file: "." }],
      recommendation:
        "For Angular: install @ngx-translate/core and configure TranslateModule. " +
        "For React: install react-i18next and wrap your app in I18nextProvider.",
      effort: "medium",
      tags: ["i18n", "localization", "setup"],
      source: "tool",
    });
  }

  return findings;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Heuristic: a text node is likely user-facing if it contains at least one word character sequence */
function isLikelyUserFacing(text: string): boolean {
  // Must contain at least one real word (letters)
  if (!/[a-zA-Z]{2,}/.test(text)) return false;
  // Skip class names, IDs, binding expressions
  if (/\[|\]|\(|\)|\*ng|\{\{|#|\bclass\b/.test(text)) return false;
  // Skip paths and URLs
  if (/^(?:\/|https?:|\.\/|\.\.\/)/.test(text.trim())) return false;
  return true;
}
