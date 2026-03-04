import type { ConsolidatedReport } from "../types.js";
import { renderHtml } from "./html.js";

// ─── PDF Report Renderer ──────────────────────────────────────────────────────
// Converts the self-contained HTML report to a PDF via headless Chromium
// (puppeteer). puppeteer is an optional peer dependency — the function throws
// a descriptive error when it is not installed so callers can surface a clear
// message, rather than a cryptic module-not-found crash.

/**
 * Render a ConsolidatedReport as a PDF buffer.
 *
 * Requires `puppeteer` to be installed (`npm install puppeteer --prefix mcp`).
 * Puppeteer downloads Chromium on first install (~300 MB).
 */
export async function renderPdf(report: ConsolidatedReport): Promise<Buffer> {
  const puppeteer = await loadPuppeteer();
  const html = renderHtml(report);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ─── Puppeteer Loader ─────────────────────────────────────────────────────────

async function loadPuppeteer(): Promise<PuppeteerLike> {
  try {
    // @ts-expect-error — puppeteer is an optional runtime dependency not declared in devDependencies
    const mod = (await import("puppeteer")) as { default: PuppeteerLike };
    return mod.default;
  } catch {
    throw new Error(
      "puppeteer is not installed.\n" +
        "Run: npm install puppeteer --prefix mcp\n" +
        "Note: puppeteer downloads Chromium (~300 MB). Ensure you have sufficient disk space.",
    );
  }
}

// ─── Minimal puppeteer surface types ─────────────────────────────────────────
// Using structural types instead of importing from puppeteer to keep pdf.ts
// compilable even before puppeteer is installed.

interface PdfOptions {
  format?: string;
  printBackground?: boolean;
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
}

interface BrowserPage {
  setContent(html: string, options?: { waitUntil?: string }): Promise<void>;
  pdf(options?: PdfOptions): Promise<Uint8Array>;
}

interface Browser {
  newPage(): Promise<BrowserPage>;
  close(): Promise<void>;
}

interface LaunchOptions {
  headless?: boolean;
  args?: string[];
}

interface PuppeteerLike {
  launch(options?: LaunchOptions): Promise<Browser>;
}
