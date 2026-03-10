import { extname, resolve, dirname } from "node:path";
import type { ImportResolver } from "./types.js";

const JAVA_PACKAGE_PATTERN = /^[a-z][\w]*(\.[a-z][\w]*)+(\.[A-Z][\w]*)?$/i;

const tsJsResolver: ImportResolver = {
  extensions: [".ts", ".js"],

  normalizeForLayerDetection(specifier) {
    return specifier;
  },

  resolveToFile(specifier, sourceFile, allFiles) {
    if (!specifier.startsWith(".")) return undefined;
    const dir = dirname(sourceFile);
    const ext = extname(specifier);
    const candidates = ext
      ? [resolve(dir, specifier)]
      : [
          resolve(dir, `${specifier}.ts`),
          resolve(dir, `${specifier}.js`),
          resolve(dir, specifier, "index.ts"),
        ];
    return candidates.find((c) => allFiles.includes(c));
  },
};

const javaResolver: ImportResolver = {
  extensions: [".java"],

  normalizeForLayerDetection(specifier) {
    if (specifier.includes(".") && !specifier.includes("/")) {
      return "/" + specifier.replace(/\./g, "/");
    }
    return specifier;
  },

  resolveToFile(specifier, _sourceFile, allFiles) {
    if (!JAVA_PACKAGE_PATTERN.test(specifier)) return undefined;
    const pathSuffix = specifier.replace(/\./g, "/") + ".java";
    return allFiles.find((f) => f.replace(/\\/g, "/").endsWith(pathSuffix));
  },
};

const ALL_RESOLVERS: ReadonlyArray<ImportResolver> = [tsJsResolver, javaResolver];

export function getImportResolver(fileExtension: string): ImportResolver | undefined {
  return ALL_RESOLVERS.find((r) => r.extensions.includes(fileExtension));
}
