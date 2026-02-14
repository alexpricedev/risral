// RISRAL Orchestrator — Plan Output Formatter
//
// Assembles the self-contained plan document that the human pastes into
// Claude Code CLI. Three sections: Execution Context, The Plan, Task List.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import type { RisralConfig, Task } from "./types.ts";
import { loadMemories, loadPatterns } from "./memory.ts";
import { parsePlanTasks } from "./state.ts";
import * as ui from "./ui.ts";

// ---------------------------------------------------------------------------
// Economics section — distilled from framework/CLAUDE.md section 2.
// This is the portable version: no references to cross-check agents,
// review agents, or orchestrator phases.
// ---------------------------------------------------------------------------

const ECONOMICS_SECTION = `## Your Economics Are Not Human Economics

You are an AI executing a plan produced by a human-AI planning session. The training data you learned from encodes human cost-benefit heuristics that do not apply to you. Override these defaults:

**Exploring is free.** Never commit to the first viable approach. When implementing a task, consider at least two ways to do it before writing code.

**Deferral is expensive.** If something needs doing and it's within scope, do it now. Never say "we can clean this up later." There is no later that remembers this context.

**Thoroughness is free.** Do not time-box yourself. Do not rush to seem efficient. Take the time the work actually requires.

**Hedging costs you nothing.** When you are uncertain, say so. When you are guessing, say so. When something could go either way, present both ways.

**You are not a human engineer with billable hours.** Act accordingly.`;

// ---------------------------------------------------------------------------
// Execution framing — tells the executor what it's doing and how to behave.
// ---------------------------------------------------------------------------

const EXECUTION_FRAMING = `## You Are Executing an Approved Plan

This document contains a plan that was produced through a structured planning process: intent alignment, backbrief, adversarial cross-check, and human approval. Your job is to execute it faithfully.

**Rules:**
- Follow the plan. Each task is described with enough context to implement.
- Do not skip tasks or reorder them unless you discover a concrete reason during implementation (e.g., a dependency that wasn't visible during planning).
- When you encounter something unexpected, resolve it using the project intent as your guide. Document what you found and what you decided.
- Do not declare a task done until it genuinely meets the description. "Good enough" is not done.
- Do not defer. If a task reveals adjacent work that's within scope, do it.
- After each task, briefly note any decisions you made that diverged from the plan description, and why.`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Assemble and output the self-contained plan document.
 *
 * 1. Writes to session/plan-output.md
 * 2. Displays in terminal via ui.showContent()
 * 3. Copies to clipboard on macOS (silent, non-blocking)
 *
 * Returns the assembled document content.
 */
export function assemblePlanOutput(config: RisralConfig, tasks: Task[]): string {
  const projectIntent = readDataFile(config, "project-intent.md");
  const sessionIntent = readSessionFile(config, "intent.md");
  const memories = loadMemories(config);
  const patterns = loadPatterns(config);
  const planContent = readSessionFile(config, "plan.md");
  const successCriteria = extractSuccessCriteria(planContent);

  const sections: string[] = [];

  // --- Section 1: Execution Context ---
  sections.push("# Execution Context\n");
  sections.push(ECONOMICS_SECTION);
  sections.push("");

  if (projectIntent) {
    sections.push("## Project Intent\n");
    sections.push(projectIntent.trim());
    sections.push("");
  }

  if (sessionIntent) {
    sections.push("## Session Intent\n");
    sections.push(sessionIntent.trim());
    sections.push("");
  }

  sections.push(EXECUTION_FRAMING);
  sections.push("");

  sections.push("## Reputation Store (Memories)\n");
  sections.push(memories);
  sections.push("");

  sections.push("## Behavioral Patterns\n");
  sections.push(patterns);
  sections.push("");

  // --- Section 2: The Plan ---
  sections.push("---\n");
  sections.push("# The Plan\n");
  if (planContent) {
    sections.push(planContent.trim());
  } else {
    sections.push("*No plan content found in session/plan.md.*");
  }
  sections.push("");

  // --- Section 3: Task List ---
  sections.push("---\n");
  sections.push("# Task List\n");

  if (tasks.length === 0) {
    sections.push("*No tasks parsed from the plan.*");
  } else {
    for (const task of tasks) {
      sections.push(`## Task ${task.index + 1}: ${task.title}\n`);
      sections.push(task.description);
      sections.push("");

      if (successCriteria) {
        sections.push("### Success Criteria\n");
        sections.push(successCriteria);
        sections.push("");
      }

      sections.push("### When Done\n");
      sections.push(
        "Document any decisions you made that diverged from this task's description. " +
        "Note what you found, what you decided, and why. Then move to the next task."
      );
      sections.push("");
    }
  }

  return sections.join("\n");
}

/**
 * Write the plan output to disk, display it, and copy to clipboard.
 */
export function outputPlan(config: RisralConfig, tasks: Task[]): void {
  const content = assemblePlanOutput(config, tasks);
  const outputPath = resolve(config.sessionDir, "plan-output.md");

  // 1. Write to disk
  writeFileSync(outputPath, content);
  ui.success(`Plan output written to session/plan-output.md`);

  // 2. Display in terminal
  ui.showContent("Plan Output", content, "session/plan-output.md");

  // 3. Copy to clipboard (macOS, silent)
  copyToClipboard(content);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readDataFile(config: RisralConfig, filename: string): string {
  const path = resolve(config.dataDir, filename);
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

function readSessionFile(config: RisralConfig, filename: string): string {
  const path = resolve(config.sessionDir, filename);
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

/**
 * Extract the ## Success Criteria section from the plan markdown.
 * Returns the section content (without the heading), or null if not found.
 */
function extractSuccessCriteria(planContent: string): string | null {
  if (!planContent) return null;

  const match = planContent.match(
    /## Success Criteria\s*\n([\s\S]*?)(?=\n## [^#]|\n---|\s*$)/
  );
  if (!match) return null;

  return match[1].trim();
}

/**
 * Try to copy content to clipboard via pbcopy (macOS).
 * Fails silently on non-macOS or if pbcopy isn't available.
 */
function copyToClipboard(content: string): void {
  try {
    execSync("which pbcopy", { stdio: "ignore" });
    execSync("pbcopy", { input: content, stdio: ["pipe", "ignore", "ignore"] });
    ui.success("Plan copied to clipboard.");
  } catch {
    // Not macOS or pbcopy not available — silent skip
  }
}
