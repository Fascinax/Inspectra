import { describe, it, expect, vi } from "vitest";
import type { ConsolidatedReport } from "../types.js";
import { makeFinding, makeDomainReport } from "./fixtures.js";

// ─── Mocks ────────────────────────────────────────────────────────────────────
// Puppeteer is an optional runtime dependency — mock it so the PDF renderer
// can be tested without a real headless Chromium instance.

const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF

const mockPage = {
  setContent: vi.fn(async () => {}),
  pdf: vi.fn(async () => PDF_MAGIC),
};

const mockBrowser = {
  newPage: vi.fn(async () => mockPage),
  close: vi.fn(async () => {}),
};

vi.mock("puppeteer", () => ({
  default: {
    launch: vi.fn(async () => mockBrowser),
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReport(overrides: Partial<ConsolidatedReport> = {}): ConsolidatedReport {
  return {
    overall_score: 75,
    grade: "B",
    summary: "Test audit report",
    domain_reports: [makeDomainReport()],
    top_findings: [makeFinding()],
    statistics: { total_findings: 1 },
    metadata: {
      timestamp: "2026-03-04T10:00:00.000Z",
      target: "/test",
      profile: "generic",
    },
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("renderPdf", () => {
  it("returns a Buffer", async () => {
    const { renderPdf } = await import("../renderer/pdf.js");
    const result = await renderPdf(makeReport());
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it("produces PDF bytes starting with %PDF magic bytes", async () => {
    const { renderPdf } = await import("../renderer/pdf.js");
    const result = await renderPdf(makeReport());
    expect(result[0]).toBe(0x25); // %
    expect(result[1]).toBe(0x50); // P
    expect(result[2]).toBe(0x44); // D
    expect(result[3]).toBe(0x46); // F
  });

  it("passes printBackground: true to preserve the dark theme", async () => {
    const { renderPdf } = await import("../renderer/pdf.js");
    await renderPdf(makeReport());
    expect(mockPage.pdf).toHaveBeenCalledWith(
      expect.objectContaining({ printBackground: true }),
    );
  });

  it("always closes the browser even if page.pdf fails", async () => {
    mockPage.pdf.mockRejectedValueOnce(new Error("Chromium crash"));
    const { renderPdf } = await import("../renderer/pdf.js");
    await expect(renderPdf(makeReport())).rejects.toThrow("Chromium crash");
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it("uses A4 format", async () => {
    const { renderPdf } = await import("../renderer/pdf.js");
    await renderPdf(makeReport());
    expect(mockPage.pdf).toHaveBeenCalledWith(
      expect.objectContaining({ format: "A4" }),
    );
  });
});
