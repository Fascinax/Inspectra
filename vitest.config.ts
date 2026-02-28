import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["mcp/src/**/*.test.ts"],
    environment: "node",
    globals: true,
  },
  resolve: {
    // Allow importing .js extensions that map to .ts source files (Node16 ESM pattern)
    extensionAlias: {
      ".js": [".ts", ".js"],
    },
  },
});
