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
  loadTasks,
  saveTasks,
} from "./state.ts";
import { runPlanning } from "./phases/planning.ts";
import { runExecution } from "./phases/execution.ts";
import { runReview } from "./phases/review.ts";
import * as ui from "./ui.ts";

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

  ui.intro();
  ui.info(`Project: ${config.projectDir}`);
  if (config.skipPermissions) {
    ui.info("Permissions: skipped (non-interactive mode)");
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
  ui.info(`Session: ${config.sessionDir}`);
  ui.info(`Current phase: ${state.phase}`);

  try {
    // --- Phase 1: Planning ---
    if (state.phase === "planning") {
      // Collect intent via CLI and persist to session
      const intent = await collectIntent(config);

      if (!intent) {
        ui.warn("No intent provided. Exiting.");
        process.exit(0);
      }

      const approved = await runPlanning(config, intent);

      if (!approved) {
        ui.info("Planning did not result in an approved plan. Exiting.");
        process.exit(0);
      }

      // Parse plan into tasks
      const tasks = parsePlanTasks(config);

      if (tasks.length === 0) {
        ui.warn(
          "Could not parse tasks from plan.md. The plan may not contain a '## Tasks' section with numbered items."
        );
        const proceed = await ui.confirmAction(
          "Continue to execution without a parsed task list?"
        );
        ui.handleCancel(proceed);

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

      ui.success(`Plan parsed into ${tasks.length} tasks. Moving to execution.`);
    }

    // --- Phase 2: Execution ---
    if (state.phase === "execution") {
      const tasks = loadTasks(config);

      if (tasks.length === 0) {
        ui.warn("No tasks found. Skipping execution.");
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
      const tasks = loadTasks(config);
      await runReview(config, tasks);

      // Mark session as complete
      state.phase = "complete";
      saveState(config, state);

      ui.phaseIntro("Session Complete");
      ui.success("All phases complete. Review the findings above.");
      ui.info(
        "Reputation scores have been updated in memories.json and patterns.json."
      );
    }

    ui.outro("Session complete");
  } catch (err) {
    ui.error(`Unexpected error: ${err}`);
    throw err;
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
    return true;
  }

  const raw = readFileSync(statePath, "utf-8");
  const prevState = JSON.parse(raw);
  const phase = prevState.phase || "unknown";
  const startedAt = prevState.startedAt || "unknown";

  ui.phaseIntro("Existing Session Detected");
  ui.info(`Started: ${startedAt}`);
  ui.info(`Phase: ${phase}`);

  if (phase === "complete") {
    const action = await ui.selectOption(
      "This session is complete. What would you like to do?",
      [
        { value: "archive" as const, label: "Archive", hint: "save and start fresh" },
        { value: "delete" as const, label: "Delete", hint: "discard and start fresh" },
        { value: "quit" as const, label: "Quit", hint: "exit without changes" },
      ],
    );
    ui.handleCancel(action);

    if (action === "archive") {
      archiveSession(config.sessionDir);
      return true;
    } else if (action === "delete") {
      deleteSession(config.sessionDir);
      return true;
    }
    return false;
  } else {
    const action = await ui.selectOption(
      "This session is in progress. What would you like to do?",
      [
        { value: "resume" as const, label: "Resume", hint: "continue where you left off" },
        { value: "archive" as const, label: "Archive", hint: "save and start fresh" },
        { value: "delete" as const, label: "Delete", hint: "discard and start fresh" },
        { value: "quit" as const, label: "Quit", hint: "exit without changes" },
      ],
    );
    ui.handleCancel(action);

    if (action === "resume") {
      ui.success("Resuming session.");
      return true;
    } else if (action === "archive") {
      archiveSession(config.sessionDir);
      return true;
    } else if (action === "delete") {
      deleteSession(config.sessionDir);
      return true;
    }
    return false;
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
  ui.success(`Session archived to sessions/${timestamp}/`);
}

function deleteSession(sessionDir: string): void {
  rmSync(sessionDir, { recursive: true, force: true });
  ui.success("Previous session deleted.");
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

  if (existsSync(intentPath)) {
    const existing = readFileSync(intentPath, "utf-8");
    ui.showContent("Existing Intent", existing);
    const keepIt = await ui.confirmAction("Use this intent?");
    ui.handleCancel(keepIt);
    if (keepIt) return existing;
  }

  const intent = await ui.collectIntent();
  ui.handleCancel(intent);

  // Persist to session
  writeFileSync(intentPath, intent as string);
  ui.success("Intent saved to session/intent.md");

  return intent as string;
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
