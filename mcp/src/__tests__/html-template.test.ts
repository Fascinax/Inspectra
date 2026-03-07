import { describe, it, expect } from "vitest";
import { FINDING_PARTIAL, REPORT_TEMPLATE } from "../renderer/html-template.js";

describe("HTML Templates", () => {
  describe("FINDING_PARTIAL", () => {
    it("contains severity styling placeholders", () => {
      expect(FINDING_PARTIAL).toContain("{{color}}");
      expect(FINDING_PARTIAL).toContain("{{severity}}");
    });

    it("contains finding metadata placeholders", () => {
      expect(FINDING_PARTIAL).toContain("{{id}}");
      expect(FINDING_PARTIAL).toContain("{{title}}");
      expect(FINDING_PARTIAL).toContain("{{confidencePercent}}");
    });

    it("contains conditional blocks", () => {
      expect(FINDING_PARTIAL).toContain("{{#if hasEffort}}");
      expect(FINDING_PARTIAL).toContain("{{#if hasLocation}}");
      expect(FINDING_PARTIAL).toContain("{{#if hasDescription}}");
      expect(FINDING_PARTIAL).toContain("{{#if hasRecommendation}}");
    });

    it("includes SVG icons", () => {
      expect(FINDING_PARTIAL).toContain("<svg");
      expect(FINDING_PARTIAL).toContain("lucide");
    });

    it("uses semantic HTML", () => {
      expect(FINDING_PARTIAL).toContain('<div class="finding"');
      expect(FINDING_PARTIAL).toContain('<div class="finding-header"');
      expect(FINDING_PARTIAL).toContain('<span class="finding-id"');
    });
  });

  describe("REPORT_TEMPLATE", () => {
    it("is a valid HTML5 document", () => {
      expect(REPORT_TEMPLATE).toContain("<!DOCTYPE html>");
      expect(REPORT_TEMPLATE).toContain("<html lang=\"en\">");
      expect(REPORT_TEMPLATE).toContain("</html>");
    });

    it("includes metadata placeholders", () => {
      expect(REPORT_TEMPLATE).toContain("{{metadata.target}}");
      expect(REPORT_TEMPLATE).toContain("{{metadata.profile}}");
    });

    it("includes score card section", () => {
      expect(REPORT_TEMPLATE).toContain('<div class="score-card">');
      expect(REPORT_TEMPLATE).toContain("{{overall_score}}");
      expect(REPORT_TEMPLATE).toContain("{{grade}}");
      expect(REPORT_TEMPLATE).toContain("{{gradeColor}}");
    });

    it("includes SVG circle progress ring", () => {
      expect(REPORT_TEMPLATE).toContain("<circle");
      expect(REPORT_TEMPLATE).toContain("stroke-dasharray");
      expect(REPORT_TEMPLATE).toContain("{{circumference}}");
      expect(REPORT_TEMPLATE).toContain("{{offset}}");
    });

    it("includes domain grid section", () => {
      expect(REPORT_TEMPLATE).toContain('<div class="domain-grid">');
      expect(REPORT_TEMPLATE).toContain("{{#each domainReportsView}}");
      expect(REPORT_TEMPLATE).toContain('<a class="domain-card"');
    });

    it("includes severity chart section", () => {
      expect(REPORT_TEMPLATE).toContain("{{#if hasSeverityData}}");
      expect(REPORT_TEMPLATE).toContain('<div class="severity-chart">');
    });

    it("uses Handlebars syntax", () => {
      expect(REPORT_TEMPLATE).toContain("{{");
      expect(REPORT_TEMPLATE).toContain("}}");
      expect(REPORT_TEMPLATE).toContain("{{#each");
      expect(REPORT_TEMPLATE).toContain("{{#if");
    });

    it("includes styles injection point", () => {
      expect(REPORT_TEMPLATE).toContain("{{{stylesHtml}}}");
    });

    it("has proper semantic structure", () => {
      expect(REPORT_TEMPLATE).toContain("<header");
      expect(REPORT_TEMPLATE).toContain("<h1>");
      expect(REPORT_TEMPLATE).toContain("<body>");
    });

    it("includes domain card statistics", () => {
      expect(REPORT_TEMPLATE).toContain("{{domainIcon}}");
      expect(REPORT_TEMPLATE).toContain("{{findingCount}}");
      expect(REPORT_TEMPLATE).toContain('<div class="progress-bar">');
    });

    it("includes viewport meta tag", () => {
      expect(REPORT_TEMPLATE).toContain('<meta name="viewport"');
    });

    it("includes charset meta tag", () => {
      expect(REPORT_TEMPLATE).toContain('<meta charset="UTF-8">');
    });
  });

  describe("Template consistency", () => {
    it("uses consistent CSS class naming", () => {
      // Both templates should use similar naming patterns
      expect(FINDING_PARTIAL).toMatch(/class="[\w-]+"/);
      expect(REPORT_TEMPLATE).toMatch(/class="[\w-]+"/);
    });

    it("uses consistent Handlebars helpers", () => {
      // Check that conditional blocks are properly closed
      const findingIfCount = (FINDING_PARTIAL.match(/{{#if/g) || []).length;
      const findingIfCloseCount = (FINDING_PARTIAL.match(/{{\/if}}/g) || []).length;
      expect(findingIfCount).toBe(findingIfCloseCount);

      const reportIfCount = (REPORT_TEMPLATE.match(/{{#if/g) || []).length;
      const reportIfCloseCount = (REPORT_TEMPLATE.match(/{{\/if}}/g) || []).length;
      expect(reportIfCount).toBe(reportIfCloseCount);
    });

    it("closes all HTML tags", () => {
      // Basic check: every opening div has a closing div
      const findingOpenDivs = (FINDING_PARTIAL.match(/<div/g) || []).length;
      const findingCloseDivs = (FINDING_PARTIAL.match(/<\/div>/g) || []).length;
      expect(findingOpenDivs).toBe(findingCloseDivs);
    });
  });
});
