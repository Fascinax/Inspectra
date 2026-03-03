import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectProfile } from "../policies/loader.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-detect-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("detectProfile", () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTempDir();
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns generic for an empty project", async () => {
    expect(await detectProfile(dir)).toBe("generic");
  });

  it("returns java-backend when pom.xml is present", async () => {
    writeFileSync(join(dir, "pom.xml"), "<project/>");
    expect(await detectProfile(dir)).toBe("java-backend");
  });

  it("returns java-backend when build.gradle is present", async () => {
    writeFileSync(join(dir, "build.gradle"), "plugins {}");
    expect(await detectProfile(dir)).toBe("java-backend");
  });

  it("returns angular-frontend when angular.json is present", async () => {
    writeFileSync(join(dir, "angular.json"), "{}");
    expect(await detectProfile(dir)).toBe("angular-frontend");
  });

  it("returns java-angular-playwright when pom.xml + angular.json + playwright.config.ts are present", async () => {
    writeFileSync(join(dir, "pom.xml"), "<project/>");
    writeFileSync(join(dir, "angular.json"), "{}");
    writeFileSync(join(dir, "playwright.config.ts"), "export default {};");
    expect(await detectProfile(dir)).toBe("java-angular-playwright");
  });

  it("returns java-angular-playwright when build.gradle + angular.json + playwright.config.js are present", async () => {
    writeFileSync(join(dir, "build.gradle"), "plugins {}");
    writeFileSync(join(dir, "angular.json"), "{}");
    writeFileSync(join(dir, "playwright.config.js"), "module.exports = {};");
    expect(await detectProfile(dir)).toBe("java-angular-playwright");
  });

  it("returns java-angular-playwright with playwright.config.mjs variant", async () => {
    writeFileSync(join(dir, "pom.xml"), "<project/>");
    writeFileSync(join(dir, "angular.json"), "{}");
    writeFileSync(join(dir, "playwright.config.mjs"), "export default {};");
    expect(await detectProfile(dir)).toBe("java-angular-playwright");
  });

  it("returns java-backend for Java+Playwright without Angular (no frontend detected)", async () => {
    writeFileSync(join(dir, "pom.xml"), "<project/>");
    writeFileSync(join(dir, "playwright.config.ts"), "export default {};");
    expect(await detectProfile(dir)).toBe("java-backend");
  });

  it("returns angular-frontend for Angular+Playwright without Java", async () => {
    writeFileSync(join(dir, "angular.json"), "{}");
    writeFileSync(join(dir, "playwright.config.ts"), "export default {};");
    expect(await detectProfile(dir)).toBe("angular-frontend");
  });

  it("treats playwright.config.* alone as generic (not a Java/Angular signal)", async () => {
    writeFileSync(join(dir, "playwright.config.ts"), "export default {};");
    expect(await detectProfile(dir)).toBe("generic");
  });

  it("prefers java-angular-playwright over java-backend when Angular also present", async () => {
    writeFileSync(join(dir, "pom.xml"), "<project/>");
    writeFileSync(join(dir, "angular.json"), "{}");
    writeFileSync(join(dir, "playwright.config.ts"), "export default {};");
    const profile = await detectProfile(dir);
    expect(profile).not.toBe("java-backend");
    expect(profile).toBe("java-angular-playwright");
  });
});
