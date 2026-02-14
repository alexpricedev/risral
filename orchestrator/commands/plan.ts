// RISRAL — Plan Command
//
// The main planning flow: intent → backbrief → plan → cross-check → approval → output.
// Session lifecycle (resume/archive/delete) lives here because it's planning-specific.

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import type { RisralConfig } from "../types.ts";
import {
  ensureSessionDir,
  loadState,
  saveState,
  parsePlanTasks,
  saveTasks,
} from "../state.ts";
import { runPlanning } from "../phases/planning.ts";
import * as ui from "../ui.ts";

export async function runPlanCommand(config: RisralConfig): Promise<void> {
  ui.intro();
  ui.info(`Project: ${config.projectDir}`);
  if (config.skipPermissions) {
    ui.info("Permissions: skipped (non-interactive mode)");
  }

  // --- Session Lifecycle ---
  const sessionHandled = await handleExistingSession(config);
  if (!sessionHandled) {
    process.exit(0);
  }

  ensureSessionDir(config);

  const state = loadState(config);
  ui.info(`Session: ${config.sessionDir}`);
  ui.info(`Current phase: ${state.phase}`);

  try {
    if (state.phase === "planning") {
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

      // Parse plan into tasks (used for structuring output in Task 4)
      const tasks = parsePlanTasks(config);

      if (tasks.length === 0) {
        ui.warn(
          "Could not parse tasks from plan.md. The plan may not contain a '## Tasks' section with numbered items."
        );
        const proceed = await ui.confirmAction(
          "Continue without a parsed task list?"
        );
        ui.handleCancel(proceed);

        if (!proceed) {
          process.exit(0);
        }

        tasks.push({
          index: 0,
          title: "Execute full plan",
          description: "Execute the approved plan as a single task.",
          status: "pending",
        });
      }

      saveTasks(config, tasks);
      state.phase = "complete";
      state.totalTasks = tasks.length;
      state.planApproved = true;
      saveState(config, state);

      ui.success(`Plan approved with ${tasks.length} tasks.`);
      // TODO: Task 4 will add the plan output formatter here
      ui.info("Take the plan from session/plan.md into Claude Code CLI to execute.");
    } else if (state.phase === "complete") {
      ui.info("This session already has an approved plan.");
      const planPath = resolve(config.sessionDir, "plan.md");
      if (existsSync(planPath)) {
        const planContent = readFileSync(planPath, "utf-8");
        ui.showContent("Approved Plan", planContent, "session/plan.md");
      }
      ui.info("Take the plan into Claude Code CLI to execute, or run 'learn' to feed outcomes back.");
    }

    ui.outro("Done");
  } catch (err) {
    ui.error(`Unexpected error: ${err}`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Session Lifecycle
// ---------------------------------------------------------------------------

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

  writeFileSync(intentPath, intent as string);
  ui.success("Intent saved to session/intent.md");

  return intent as string;
}
