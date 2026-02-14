#!/usr/bin/env bun

// RISRAL Init — Thin wrapper for backward compatibility
//
// Delegates to orchestrator/commands/init.ts.
// Prefer: bun run start init

import { loadConfig } from "../orchestrator/config.ts";
import { runInitCommand } from "../orchestrator/commands/init.ts";

const config = loadConfig(process.argv.slice(2));

runInitCommand(config).catch((err) => {
  console.error(`Init failed: ${err}`);
  process.exit(1);
});
