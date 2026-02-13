#!/usr/bin/env bun

// RISRAL Orchestrator
//
// Manages the full RISRAL lifecycle:
//   Phase 1: Planning (with adversarial cross-check)
//   Phase 2: Execution (task-by-task with context resets)
//   Phase 3: Review (drift detection and reputation scoring)
//
// Usage:
//   bun run start -- [project-dir] [options]
//
// Options:
//   --model <model>        Claude model to use (default: claude's default)
//   --max-budget <usd>     Max budget per CLI invocation
//   --no-skip-permissions  Require permission prompts (default: permissions skipped)

import { existsSync, mkdirSync, renameSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
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

  io.phaseHeader("RISRAL Orchestrator", `Framework: ${config.frameworkDir}`);
  io.status(`Project: ${config.projectDir}`);
  if (config.skipPermissions) {
    io.status("Permissions: skipped (non-interactive mode)");
  }

  // --- Session Lifecycle ---
  // Detect existing session and let the human decide what to do
  const sessionHandled = await handleExistingSession(config);
  if (!sessionHandled) {
    process.exit(0);
  }

  // Ensure session directory exists
  ensureSessionDir(config);

  // Load or create state
  const state = loadState(config);
  io.status(`Session: ${config.sessionDir}`);
  io.status(`Current phase: ${state.phase}`);

  try {
    // --- Phase 1: Planning ---
    if (state.phase === "planning") {
      // Collect intent via CLI and persist to session
      const intent = await collectIntent(config);

      if (!intent) {
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

      // Mark session as complete
      state.phase = "complete";
      saveState(config, state);

      io.phaseHeader("Session Complete");
      io.success("All phases complete. Review the findings above.");
      io.status(
        "Reputation scores have been updated in memories.json and patterns.json."
      );
    }
  } finally {
    io.close();
  }
}

// ---------------------------------------------------------------------------
// Session Lifecycle
// ---------------------------------------------------------------------------

/**
 * Detect an existing session and let the human choose what to do.
 *
 * Returns true if we should proceed (fresh session or resumed),
 * false if the user chose to exit.
 */
async function handleExistingSession(config: { sessionDir: string }): Promise<boolean> {
  const statePath = resolve(config.sessionDir, "state.json");

  if (!existsSync(statePath)) {
    // No previous session — start fresh
    return true;
  }

  const raw = readFileSync(statePath, "utf-8");
  const prevState = JSON.parse(raw);
  const phase = prevState.phase || "unknown";
  const startedAt = prevState.startedAt || "unknown";

  io.phaseHeader("Existing Session Detected");
  io.status(`Started: ${startedAt}`);
  io.status(`Phase: ${phase}`);
  console.log("");

  if (phase === "complete") {
    // Session finished — offer archive or delete
    const choice = await io.ask(
      "This session is complete. What would you like to do?\n" +
        "  [a] Archive and start fresh\n" +
        "  [d] Delete and start fresh\n" +
        "  [q] Quit\n" +
        "Choice: "
    );

    switch (choice.toLowerCase()) {
      case "a":
        archiveSession(config.sessionDir);
        return true;
      case "d":
        deleteSession(config.sessionDir);
        return true;
      default:
        return false;
    }
  } else {
    // Session in progress — offer resume, archive, or delete
    const choice = await io.ask(
      "This session is in progress. What would you like to do?\n" +
        "  [r] Resume where you left off\n" +
        "  [a] Archive and start fresh\n" +
        "  [d] Delete and start fresh\n" +
        "  [q] Quit\n" +
        "Choice: "
    );

    switch (choice.toLowerCase()) {
      case "r":
        io.success("Resuming session.");
        return true;
      case "a":
        archiveSession(config.sessionDir);
        return true;
      case "d":
        deleteSession(config.sessionDir);
        return true;
      default:
        return false;
    }
  }
}

function archiveSession(sessionDir: string): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const parentDir = resolve(sessionDir, "..");
  const archiveBase = resolve(parentDir, "sessions");

  if (!existsSync(archiveBase)) {
    mkdirSync(archiveBase, { recursive: true });
  }

  const archivePath = resolve(archiveBase, timestamp);
  renameSync(sessionDir, archivePath);
  io.success(`Session archived to sessions/${timestamp}/`);
}

function deleteSession(sessionDir: string): void {
  rmSync(sessionDir, { recursive: true, force: true });
  io.success("Previous session deleted.");
}

// ---------------------------------------------------------------------------
// Intent Collection
// ---------------------------------------------------------------------------

/**
 * Collect the session intent from the human via CLI.
 *
 * The intent is persisted to session/intent.md so it's part of the
 * session record and available to all prompts.
 */
async function collectIntent(config: { sessionDir: string }): Promise<string | null> {
  const intentPath = resolve(config.sessionDir, "intent.md");

  // If resuming a session that already has an intent, use it
  if (existsSync(intentPath)) {
    const existing = readFileSync(intentPath, "utf-8");
    io.status("Intent loaded from session:");
    console.log(`\n${existing}\n`);
    const keepIt = await io.confirm("Use this intent?");
    if (keepIt) return existing;
  }

  console.log("");
  const intent = await io.askMultiline(
    "What's your intent for this session?\nDescribe what you want to achieve, why it matters, and what success looks like."
  );

  if (intent === "") return null;

  // Persist to session
  writeFileSync(intentPath, intent);
  io.success("Intent saved to session/intent.md");

  return intent;
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log(`
RISRAL Orchestrator — Reputation-Inclusive Self-Referential Agentic Loop

Usage:
  bun run start -- [project-dir] [options]

Arguments:
  project-dir      Path to the project directory (defaults to parent of RISRAL)

Options:
  --model <model>       Claude model to use
  --max-budget <usd>    Maximum budget per CLI invocation in USD
  --no-skip-permissions Require permission prompts (default: auto-skipped for -p mode)
  -h, --help            Show this help message

Lifecycle:
  1. You describe your intent for this session
  2. AI backbriefs — reflects understanding, asks questions
  3. You respond to the backbrief
  4. AI plans (picks the best approach, not a menu of options)
  5. Adversarial cross-check reviews the plan
  6. You approve the plan
  7. AI executes task-by-task (fresh context per task)
  8. Review agent checks output against plan
  9. Reputation scores updated

Session management:
  On startup, if a previous session exists, you can:
  - Resume an in-progress session
  - Archive a completed session (moved to sessions/<timestamp>/)
  - Delete and start fresh
`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
