import { describe, it, expect } from "vitest";
import { extractModuleSpecifiers, computeCyclomaticComplexity } from "../utils/ast.js";

describe("extractModuleSpecifiers", () => {
  it("extracts ES6 import statements", () => {
    const source = `
      import { foo } from './foo';
      import bar from './bar';
      import * as baz from './baz';
    `;
    const specifiers = extractModuleSpecifiers(source, ".ts");
    expect(specifiers).toEqual(["./foo", "./bar", "./baz"]);
  });

  it("extracts named exports with source", () => {
    const source = `
      export { foo } from './foo';
      export * from './bar';
    `;
    const specifiers = extractModuleSpecifiers(source, ".ts");
    expect(specifiers).toEqual(["./foo", "./bar"]);
  });

  it("ignores local exports without source", () => {
    const source = `
      export const x = 1;
      export function y() {}
    `;
    const specifiers = extractModuleSpecifiers(source, ".ts");
    expect(specifiers).toEqual([]);
  });

  it("falls back to regex for non-TS files", () => {
    const javaSource = `
      import java.util.List;
      import com.example.Service;
    `;
    const specifiers = extractModuleSpecifiers(javaSource, ".java");
    expect(specifiers.length).toBeGreaterThan(0);
  });

  it("handles JSX files", () => {
    const source = `import React from 'react';`;
    const specifiers = extractModuleSpecifiers(source, ".jsx");
    expect(specifiers).toEqual(["react"]);
  });

  it("returns empty array for files with no imports", () => {
    const source = "const x = 1;";
    const specifiers = extractModuleSpecifiers(source, ".ts");
    expect(specifiers).toEqual([]);
  });
});

describe("computeCyclomaticComplexity", () => {
  it("returns 1 for linear code with no branches", () => {
    const source = `
      function foo() {
        const x = 1;
        const y = 2;
        return x + y;
      }
    `;
    const complexity = computeCyclomaticComplexity(source, ".ts");
    expect(complexity).toBe(1);
  });

  it("increments for if statements", () => {
    const source = `
      function foo(x) {
        if (x > 0) {
          return 1;
        }
        return 0;
      }
    `;
    const complexity = computeCyclomaticComplexity(source, ".ts");
    expect(complexity).toBe(2);
  });

  it("increments for loops", () => {
    const source = `
      function foo(arr) {
        for (let i = 0; i < arr.length; i++) {
          console.log(i);
        }
        while (true) {
          break;
        }
      }
    `;
    const complexity = computeCyclomaticComplexity(source, ".ts");
    expect(complexity).toBe(3); // 1 base + for + while
  });

  it("increments for logical operators", () => {
    const source = `
      function foo(a, b) {
        return a && b;
      }
    `;
    const complexity = computeCyclomaticComplexity(source, ".ts");
    expect(complexity).toBe(2);
  });

  it("increments for catch clauses", () => {
    const source = `
      function foo() {
        try {
          throw new Error();
        } catch (e) {
          console.error(e);
        }
      }
    `;
    const complexity = computeCyclomaticComplexity(source, ".ts");
    expect(complexity).toBe(2);
  });

  it("increments for switch cases but not default", () => {
    const source = `
      function foo(x) {
        switch (x) {
          case 1: return 'one';
          case 2: return 'two';
          default: return 'other';
        }
      }
    `;
    const complexity = computeCyclomaticComplexity(source, ".ts");
    expect(complexity).toBe(3); // 1 + case 1 + case 2 (default doesn't count)
  });

  it("falls back to heuristic for non-parseable code", () => {
    const javaSource = `
      public void foo(int x) {
        if (x > 0) {
          return;
        }
      }
    `;
    const complexity = computeCyclomaticComplexity(javaSource, ".java");
    expect(complexity).toBeGreaterThan(1);
  });

  it("handles complex nested structures", () => {
    const source = `
      function foo(a, b, c) {
        if (a) {
          if (b) {
            return 1;
          } else if (c) {
            return 2;
          }
        }
        for (let i = 0; i < 10; i++) {
          if (i % 2 === 0) {
            continue;
          }
        }
        return 0;
      }
    `;
    const complexity = computeCyclomaticComplexity(source, ".ts");
    expect(complexity).toBeGreaterThan(5);
  });
});
