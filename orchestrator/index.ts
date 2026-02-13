#!/usr/bin/env bun

// RISRAL Orchestrator
//
// Manages the full RISRAL lifecycle:
//   Phase 1: Planning (with adversarial cross-check)
//   Phase 2: Execution (task-by-task with context resets)
//   Phase 3: Review (drift detection and reputation scoring)
//
// Usage:
//   risral <framework-dir> [project-dir] [options]
//
// Options:
//   --model <model>        Claude model to use (default: claude's default)
//   --max-budget <usd>     Max budget per CLI invocation
//   --no-skip-permissions  Require permission prompts (default: permissions skipped)
//
// The framework directory must contain:
//   CLAUDE.md, memories.json, patterns.json,
//   cross-check-mandate.md, onboarding-protocol.md

import { loadConfig, validateConfig } from "./config.ts";
import {
  ensureSessionDir,
  loadState,
  saveState,
  parsePlanTasks,
  saveTasks,
} from "./state.ts";
import { runPlanning } from "./phases/planning.ts";
import { runExecution } from "./phases/execution.ts";
import { runReview } from "./phases/review.ts";
import * as io from "./io.ts";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Help
  if (args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  // Load and validate config
  const config = loadConfig(args);
  const errors = validateConfig(config);

  if (errors.length > 0) {
    console.error("Configuration errors:");
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  // Set up session directory
  ensureSessionDir(config);

  // Load or create state
  const state = loadState(config);

  io.phaseHeader("RISRAL Orchestrator", `Framework: ${config.frameworkDir}`);
  io.status(`Project: ${config.projectDir}`);
  io.status(`Session: ${config.sessionDir}`);
  io.status(`Current phase: ${state.phase}`);
  if (config.skipPermissions) {
    io.status("Permissions: skipped (non-interactive mode)");
  }

  try {
    // --- Phase 1: Planning ---
    if (state.phase === "planning") {
      const intent = await io.askMultiline(
        "What's your intent for this session? Describe what you want to achieve and why."
      );

      if (intent === "") {
        io.warn("No intent provided. Exiting.");
        process.exit(0);
      }

      const approved = await runPlanning(config, intent);

      if (!approved) {
        io.status("Planning did not result in an approved plan. Exiting.");
        process.exit(0);
      }

      // Parse plan into tasks
      const tasks = parsePlanTasks(config);

      if (tasks.length === 0) {
        io.warn(
          "Could not parse tasks from plan.md. The plan may not contain a '## Tasks' section with numbered items."
        );
        const proceed = await io.confirm(
          "Continue to execution without a parsed task list?"
        );

        if (!proceed) {
          process.exit(0);
        }

        // Create a single task from the whole plan
        tasks.push({
          index: 0,
          title: "Execute full plan",
          description: "Execute the approved plan as a single task.",
          status: "pending",
        });
      }

      saveTasks(config, tasks);
      state.phase = "execution";
      state.totalTasks = tasks.length;
      state.planApproved = true;
      saveState(config, state);

      io.success(`Plan parsed into ${tasks.length} tasks. Moving to execution.`);
    }

    // --- Phase 2: Execution ---
    if (state.phase === "execution") {
      const tasks = parsePlanTasks(config);

      if (tasks.length === 0) {
        io.warn("No tasks found. Skipping execution.");
      } else {
        // Resume from where we left off
        const remainingTasks = tasks.filter((_, i) => i >= state.taskIndex);
        const completedTasks = await runExecution(config, remainingTasks);

        // Update state after each completed task
        for (const task of completedTasks) {
          if (task.status === "completed" || task.status === "failed") {
            state.taskIndex = task.index + 1;
            saveState(config, state);
          }
        }

        saveTasks(config, tasks);
      }

      state.phase = "review";
      saveState(config, state);
    }

    // --- Phase 3: Review ---
    if (state.phase === "review") {
      const tasks = parsePlanTasks(config);
      await runReview(config, tasks);

      io.phaseHeader("Session Complete");
      io.success("All phases complete. Review the findings above.");
      io.status("Reputation scores have been updated in memories.json and patterns.json.");
    }
  } finally {
    io.close();
  }
}

function printUsage(): void {
  console.log(`
RISRAL Orchestrator — Reputation-Inclusive Self-Referential Agentic Loop

Usage:
  risral <framework-dir> [project-dir] [options]

Arguments:
  framework-dir    Path to the RISRAL framework directory
                   (must contain CLAUDE.md, memories.json, etc.)
  project-dir      Path to the project directory (defaults to framework-dir)

Options:
  --model <model>       Claude model to use
  --max-budget <usd>    Maximum budget per CLI invocation in USD
  --no-skip-permissions Require permission prompts (default: auto-skipped for -p mode)
  -h, --help            Show this help message

Lifecycle:
  1. You provide your intent
  2. AI plans and gets adversarially cross-checked
  3. You approve the plan
  4. AI executes task-by-task (fresh context per task)
  5. Review agent checks output against plan
  6. Reputation scores updated

Required framework files:
  CLAUDE.md               Operating framework
  memories.json           Project-specific reputation store
  patterns.json           Portable behavioral patterns
  cross-check-mandate.md  Adversarial review criteria
  onboarding-protocol.md  Cold start protocol
`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
