import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Finding } from "../types.js";
import type { ProfileConfig } from "../policies/loader.js";
import { findingsResponse, withErrorHandling } from "./response.js";
import type { ResponseFormat } from "./response.js";
import { validateProjectDir } from "../utils/paths.js";
import { loadProjectConfig, resolveConfig } from "../utils/project-config.js";
import { loadProfile } from "../policies/loader.js";

interface StandardInput {
  projectDir: string;
  responseFormat?: ResponseFormat;
  limit?: number;
  offset?: number;
}

interface ProfiledInput extends StandardInput {
  profile?: string;
}

type ToolFn = (projectDir: string) => Promise<Finding[]>;
type ToolFnWithIgnore = (projectDir: string, ignoreDirs?: string[]) => Promise<Finding[]>;
type ToolFnWithProfile = (projectDir: string, profileConfig?: ProfileConfig) => Promise<Finding[]>;

export function createStandardHandler(
  toolName: string,
  toolFn: ToolFn,
): (params: StandardInput) => Promise<CallToolResult> {
  return withErrorHandling(async ({ projectDir, responseFormat, limit, offset }: StandardInput) => {
    const safeDir = await validateProjectDir(projectDir);
    const findings = await toolFn(safeDir);
    return findingsResponse(findings, responseFormat, { limit, offset });
  }, toolName);
}

export function createConfigHandler(
  toolName: string,
  toolFn: ToolFnWithIgnore,
): (params: StandardInput) => Promise<CallToolResult> {
  return withErrorHandling(async ({ projectDir, responseFormat, limit, offset }: StandardInput) => {
    const safeDir = await validateProjectDir(projectDir);
    const config = resolveConfig(await loadProjectConfig(safeDir));
    const findings = await toolFn(safeDir, config.ignore_dirs);
    return findingsResponse(findings, responseFormat, { limit, offset });
  }, toolName);
}

export function createProfiledHandler(
  toolName: string,
  policiesDir: string,
  toolFn: ToolFnWithProfile,
): (params: ProfiledInput) => Promise<CallToolResult> {
  return withErrorHandling(async ({ projectDir, profile, responseFormat, limit, offset }: ProfiledInput) => {
    const safeDir = await validateProjectDir(projectDir);
    const profileConfig = profile ? await loadProfile(policiesDir, profile) : undefined;
    const findings = await toolFn(safeDir, profileConfig);
    return findingsResponse(findings, responseFormat, { limit, offset });
  }, toolName);
}
