// @ts-check
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import eslintConfigPrettier from "eslint-config-prettier";
import { resolve } from "node:path";

const TSCONFIG = resolve(import.meta.dirname, "mcp", "tsconfig.json");

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
  // ─── Ignored paths ───────────────────────────────────────────────────────
  {
    ignores: [
      "mcp/dist/**",
      "node_modules/**",
      "mcp/node_modules/**",
      "coverage/**",
      "mcp/src/__tests__/fixtures/**",
    ],
  },

  // ─── TypeScript source files ─────────────────────────────────────────────
  {
    files: ["mcp/src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: TSCONFIG,
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": /** @type {any} */ (tsPlugin),
    },
    rules: {
      // Core ESLint
      "no-console": "warn",
      "no-debugger": "error",
      "no-duplicate-imports": "error",
      "prefer-const": "error",
      "no-var": "error",
      "eqeqeq": ["error", "always", { "null": "ignore" }],
      "curly": ["error", "all"],

      // TypeScript-specific
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-non-null-assertion": "warn",
    },
  },

  // ─── Test files (relaxed rules) ──────────────────────────────────────────
  {
    files: ["mcp/src/__tests__/**/*.ts"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },

  // ─── Prettier (must be last) ──────────────────────────────────────────────
  eslintConfigPrettier,
];
