import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger } from "../logger.js";

describe("logger", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  const originalLevel = process.env.INSPECTRA_LOG_LEVEL;

  beforeEach(() => {
    stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    if (originalLevel === undefined) {
      delete process.env.INSPECTRA_LOG_LEVEL;
    } else {
      process.env.INSPECTRA_LOG_LEVEL = originalLevel;
    }
    logger.reload();
  });

  it("writes to stderr via console.error", () => {
    process.env.INSPECTRA_LOG_LEVEL = "debug";
    logger.reload();

    logger.info("hello");
    expect(stderrSpy).toHaveBeenCalledOnce();
    expect(stderrSpy.mock.calls[0]![0]).toContain("[INFO ]");
    expect(stderrSpy.mock.calls[0]![0]).toContain("hello");
  });

  it("formats messages with ISO timestamp", () => {
    logger.info("ts-test");
    const output = stderrSpy.mock.calls[0]![0] as string;
    expect(output).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("includes context as JSON when provided", () => {
    logger.info("with-ctx", { tool: "scan_secrets", projectDir: "/app" });
    const output = stderrSpy.mock.calls[0]![0] as string;
    expect(output).toContain('"tool":"scan_secrets"');
    expect(output).toContain('"projectDir":"/app"');
  });

  it("respects log level — suppresses debug when level is info", () => {
    process.env.INSPECTRA_LOG_LEVEL = "info";
    logger.reload();

    logger.debug("should-not-appear");
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("shows warn and error when level is warn", () => {
    process.env.INSPECTRA_LOG_LEVEL = "warn";
    logger.reload();

    logger.info("suppressed");
    logger.warn("visible-warn");
    logger.error("visible-error");

    expect(stderrSpy).toHaveBeenCalledTimes(2);
    expect(stderrSpy.mock.calls[0]![0]).toContain("[WARN ]");
    expect(stderrSpy.mock.calls[1]![0]).toContain("[ERROR]");
  });

  it("defaults to info when env var is unset", () => {
    delete process.env.INSPECTRA_LOG_LEVEL;
    logger.reload();

    expect(logger.getLevel()).toBe("info");
  });

  it("defaults to info when env var is invalid", () => {
    process.env.INSPECTRA_LOG_LEVEL = "verbose";
    logger.reload();

    expect(logger.getLevel()).toBe("info");
  });

  it("debug level enables all messages", () => {
    process.env.INSPECTRA_LOG_LEVEL = "debug";
    logger.reload();

    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    expect(stderrSpy).toHaveBeenCalledTimes(4);
  });

  it("error level suppresses everything below error", () => {
    process.env.INSPECTRA_LOG_LEVEL = "error";
    logger.reload();

    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");

    expect(stderrSpy).toHaveBeenCalledOnce();
    expect(stderrSpy.mock.calls[0]![0]).toContain("[ERROR]");
  });
});
