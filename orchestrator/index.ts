#!/usr/bin/env bun

// RISRAL Orchestrator — Subcommand Router
//
// Routes to the appropriate command handler:
//   plan   — run a planning session (default)
//   learn  — feed execution outcomes back into reputation
//   status — view reputation state
//   init   — project setup

import { loadConfig, validateConfig } from "./config.ts";
import { runPlanCommand } from "./commands/plan.ts";
import { runLearnCommand } from "./commands/learn.ts";
import { runStatusCommand } from "./commands/status.ts";
import { runInitCommand } from "./commands/init.ts";

const SUBCOMMANDS = ["plan", "learn", "status", "init"] as const;
type Subcommand = (typeof SUBCOMMANDS)[number];

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  // Extract subcommand: first non-flag arg that matches a known command
  let subcommand: Subcommand = "plan";
  const remainingArgs: string[] = [];
  let subcommandFound = false;

  for (const arg of args) {
    if (!subcommandFound && !arg.startsWith("-") && SUBCOMMANDS.includes(arg as Subcommand)) {
      subcommand = arg as Subcommand;
      subcommandFound = true;
    } else {
      remainingArgs.push(arg);
    }
  }

  const config = loadConfig(remainingArgs);

  // Skip validation for init — it creates the files that validation checks for
  if (subcommand !== "init") {
    const errors = validateConfig(config);

    if (errors.length > 0) {
      console.error("Configuration errors:");
      for (const error of errors) {
        console.error(`  - ${error}`);
      }
      process.exit(1);
    }
  }

  switch (subcommand) {
    case "plan":
      await runPlanCommand(config);
      break;
    case "learn":
      await runLearnCommand(config);
      break;
    case "status":
      await runStatusCommand(config);
      break;
    case "init":
      await runInitCommand(config);
      break;
  }
}

function printUsage(): void {
  console.log(`
RISRAL — Reputation-Inclusive Self-Referential Agentic Loop

Usage:
  bun run start [command] [options]

Commands:
  plan     Run a planning session (default if no command given)
           Intent → backbrief → plan → cross-check → approval → output
  learn    Feed execution outcomes back into the reputation system
  status   View current memories and behavioral patterns
  init     Set up project intent and data directory (one-time)

Options:
  --model <model>       Claude model to use
  --max-budget <usd>    Maximum budget per CLI invocation in USD
  --no-skip-permissions Require permission prompts
  -h, --help            Show this help message

Lifecycle:
  1. bun run init       Set up project intent (one-time)
  2. bun run plan       Plan a session (intent → backbrief → plan → output)
  3. Paste the plan output into Claude Code CLI and execute it
  4. bun run learn      Feed outcomes back into the reputation system
  5. bun run status     View your reputation state

Shortcuts:
  bun run start         Alias for 'bun run plan'
  bun run start <cmd>   Same as 'bun run <cmd>'
`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
