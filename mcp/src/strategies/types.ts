export type Route = {
  path: string;
  method: string;
  file: string;
  line: number;
};

export type ImportResolver = {
  readonly extensions: ReadonlyArray<string>;
  normalizeForLayerDetection(specifier: string): string;
  resolveToFile(
    specifier: string,
    sourceFile: string,
    allFiles: ReadonlyArray<string>,
  ): string | undefined;
};

export type RouteExtractor = {
  extractRoutes(content: string, file: string): Route[];
};

export type HealthDetector = {
  hasHealthEndpoint(content: string): boolean;
  hasHealthConfig(projectDir: string): Promise<boolean>;
};
