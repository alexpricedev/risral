// RISRAL Orchestrator — Configuration
//
// Resolves paths relative to the RISRAL repo root.
// The repo structure is:
//   framework/   — CLAUDE.md, cross-check-mandate.md, onboarding-protocol.md
//   data/        — memories.json, patterns.json (project-specific)
//   orchestrator/ — this code
//   session/     — runtime state (created by orchestrator)

import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { RisralConfig } from "./types.ts";

// Resolve the RISRAL repo root from the orchestrator location
// orchestrator/config.ts → ../ = repo root
const RISRAL_ROOT = resolve(import.meta.dirname!, "..");

const REQUIRED_FRAMEWORK_FILES = [
  "CLAUDE.md",
  "cross-check-mandate.md",
  "onboarding-protocol.md",
];

const REQUIRED_DATA_FILES = ["memories.json", "patterns.json"];

export function loadConfig(args: string[]): RisralConfig {
  // First non-flag argument is the project directory
  const positionalArgs = args.filter((a) => !a.startsWith("--"));
  const projectDir = resolve(positionalArgs[0] || resolve(RISRAL_ROOT, ".."));

  const frameworkDir = resolve(RISRAL_ROOT, "framework");
  const dataDir = resolve(RISRAL_ROOT, "data");
  const sessionDir = resolve(RISRAL_ROOT, "session");

  // Default skipPermissions to true because all CLI invocations run in
  // non-interactive -p mode — there's no way to answer permission prompts.
  // Use --no-skip-permissions to override (e.g. if you have a
  // .claude/settings.json that pre-allows the necessary tools).
  const skipPermissions = !args.includes("--no-skip-permissions");

  return {
    frameworkDir,
    dataDir,
    projectDir,
    sessionDir,
    model: getArgValue(args, "--model"),
    maxBudgetPerInvocation: getArgNumber(args, "--max-budget"),
    skipPermissions,
  };
}

export function validateConfig(config: RisralConfig): string[] {
  const errors: string[] = [];

  if (!existsSync(config.frameworkDir)) {
    errors.push(`Framework directory not found: ${config.frameworkDir}`);
  } else {
    for (const file of REQUIRED_FRAMEWORK_FILES) {
      const filePath = resolve(config.frameworkDir, file);
      if (!existsSync(filePath)) {
        errors.push(`Required framework file missing: framework/${file}`);
      }
    }
  }

  if (!existsSync(config.dataDir)) {
    errors.push(
      `Data directory not found: ${config.dataDir} — run 'bun run init' first`
    );
  } else {
    for (const file of REQUIRED_DATA_FILES) {
      const filePath = resolve(config.dataDir, file);
      if (!existsSync(filePath)) {
        errors.push(
          `Required data file missing: data/${file} — run 'bun run init' first`
        );
      }
    }
  }

  if (!existsSync(config.projectDir)) {
    errors.push(`Project directory not found: ${config.projectDir}`);
  }

  return errors;
}

function getArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) return undefined;
  return args[index + 1];
}

function getArgNumber(args: string[], flag: string): number | undefined {
  const value = getArgValue(args, flag);
  if (value === undefined) return undefined;
  const num = parseFloat(value);
  return isNaN(num) ? undefined : num;
}
