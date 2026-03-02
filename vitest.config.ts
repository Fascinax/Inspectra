import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["mcp/src/**/*.test.ts"],
    exclude: ["mcp/src/__tests__/fixtures/**"],
    environment: "node",
    globals: true,
    coverage: {
      provider: "v8",
      include: ["mcp/src/**/*.ts"],
      exclude: [
        "mcp/src/**/*.test.ts",
        "mcp/src/__tests__/**",
        "mcp/src/index.ts",
      ],
      thresholds: {
        lines: 70,
        branches: 60,
        functions: 70,
        statements: 70,
      },
      reporter: ["text", "lcov", "html"],
    },
  },
  resolve: {
    // Allow importing .js extensions that map to .ts source files (Node16 ESM pattern)
    extensionAlias: {
      ".js": [".ts", ".js"],
    },
  },
});
