// RISRAL Orchestrator — State Management
//
// Tracks the current phase, task progress, and session metadata.
// Persists to session/state.json so the orchestrator can resume
// if interrupted.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { RisralConfig, OrchestratorState, Task } from "./types.ts";

function statePath(config: RisralConfig): string {
  return resolve(config.sessionDir, "state.json");
}

function tasksPath(config: RisralConfig): string {
  return resolve(config.sessionDir, "tasks.json");
}

/**
 * Ensure the session directory exists.
 */
export function ensureSessionDir(config: RisralConfig): void {
  if (!existsSync(config.sessionDir)) {
    mkdirSync(config.sessionDir, { recursive: true });
  }
}

/**
 * Load existing state or create fresh state.
 */
export function loadState(config: RisralConfig): OrchestratorState {
  const path = statePath(config);

  if (existsSync(path)) {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as OrchestratorState;
  }

  return {
    phase: "planning",
    taskIndex: 0,
    totalTasks: 0,
    planApproved: false,
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Save state to disk.
 */
export function saveState(
  config: RisralConfig,
  state: OrchestratorState
): void {
  state.lastUpdated = new Date().toISOString();
  writeFileSync(statePath(config), JSON.stringify(state, null, 2));
}

/**
 * Parse the plan.md file to extract a task list.
 *
 * Looks for a "## Tasks" section with numbered items.
 * Each item becomes a task with title and description.
 */
export function parsePlanTasks(config: RisralConfig): Task[] {
  const planPath = resolve(config.sessionDir, "plan.md");

  if (!existsSync(planPath)) {
    return [];
  }

  const plan = readFileSync(planPath, "utf-8");
  const tasks: Task[] = [];

  // Find the ## Tasks section (capture everything after "## Tasks" until next
  // same-level heading, a horizontal rule, or end of string)
  const tasksMatch = plan.match(/## Tasks\s*\n([\s\S]*?)(?=\n## [^#]|\n---|\s*$)/);
  if (!tasksMatch) return [];

  const tasksSection = tasksMatch[1];

  // Strategy 1: "### N. Title" (sub-heading style, as seen in real plans)
  // Capture title from the heading line and description from the body below it
  const headingPattern = /###\s*(\d+)\.\s+(.+)/g;
  let headingMatch;
  const headingPositions: { index: number; num: number; title: string; pos: number }[] = [];

  while ((headingMatch = headingPattern.exec(tasksSection)) !== null) {
    headingPositions.push({
      index: headingPositions.length,
      num: parseInt(headingMatch[1], 10),
      title: headingMatch[2].trim().replace(/\*\*/g, "").replace(/`/g, ""),
      pos: headingMatch.index + headingMatch[0].length,
    });
  }

  if (headingPositions.length > 0) {
    for (let i = 0; i < headingPositions.length; i++) {
      const start = headingPositions[i].pos;
      const end = i + 1 < headingPositions.length
        ? tasksSection.lastIndexOf("###", headingPositions[i + 1].pos)
        : tasksSection.length;
      const description = tasksSection.slice(start, end).trim();

      tasks.push({
        index: tasks.length,
        title: headingPositions[i].title,
        description: description || headingPositions[i].title,
        status: "pending",
      });
    }
    return tasks;
  }

  // Strategy 2: "N. **Title** — Description" or "N. Title" (inline style)
  const inlinePattern =
    /(?:^|\n)\s*(\d+)\.\s+\*{0,2}(.+?)\*{0,2}\s*(?:[—\-:]\s*)?(.+?)(?=\n\s*\d+\.|\n\s*$|$)/gs;

  let inlineMatch;
  while ((inlineMatch = inlinePattern.exec(tasksSection)) !== null) {
    tasks.push({
      index: tasks.length,
      title: inlineMatch[2].trim(),
      description: inlineMatch[3].trim(),
      status: "pending",
    });
  }

  // Strategy 3: Simplest fallback — any line starting with a number and dot
  if (tasks.length === 0) {
    const lines = tasksSection.split("\n");
    for (const line of lines) {
      const simpleMatch = line.match(/^\s*\d+\.\s+(.+)/);
      if (simpleMatch) {
        tasks.push({
          index: tasks.length,
          title: simpleMatch[1].trim().replace(/\*\*/g, ""),
          description: simpleMatch[1].trim().replace(/\*\*/g, ""),
          status: "pending",
        });
      }
    }
  }

  return tasks;
}

/**
 * Save tasks to disk.
 */
export function saveTasks(config: RisralConfig, tasks: Task[]): void {
  writeFileSync(tasksPath(config), JSON.stringify(tasks, null, 2));
}

/**
 * Load tasks from disk.
 */
export function loadTasks(config: RisralConfig): Task[] {
  const path = tasksPath(config);
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf-8")) as Task[];
}

/**
 * Read the accumulated decision log.
 */
export function readDecisionLog(config: RisralConfig): string {
  const path = resolve(config.sessionDir, "decision-log.md");
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

/**
 * Append a task's decisions to the decision log.
 */
export function appendDecisionLog(
  config: RisralConfig,
  taskIndex: number,
  taskTitle: string,
  content: string
): void {
  const path = resolve(config.sessionDir, "decision-log.md");
  const existing = existsSync(path) ? readFileSync(path, "utf-8") : "";
  const entry = `\n\n### Task ${taskIndex + 1}: ${taskTitle}\n\n${content}`;
  writeFileSync(path, existing + entry);
}
