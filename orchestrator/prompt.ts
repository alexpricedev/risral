// RISRAL Orchestrator — Prompt Assembly
//
// Reads framework files and assembles them into system prompts
// for each phase. Different phases get different context.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { RisralConfig, Task } from "./types.ts";

function readFile(path: string): string {
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

function readFrameworkFile(config: RisralConfig, filename: string): string {
  return readFile(resolve(config.frameworkDir, filename));
}

function readDataFile(config: RisralConfig, filename: string): string {
  return readFile(resolve(config.dataDir, filename));
}

function readSessionFile(config: RisralConfig, filename: string): string {
  return readFile(resolve(config.sessionDir, filename));
}

/**
 * Assemble the system prompt for Phase 1: Planning.
 *
 * Includes: CLAUDE.md + memories + patterns + planning instructions
 */
export function assemblePlanningPrompt(config: RisralConfig): string {
  const claude = readFrameworkFile(config, "CLAUDE.md");
  const memories = readDataFile(config, "memories.json");
  const patterns = readDataFile(config, "patterns.json");

  return `${claude}

---

# CURRENT SESSION: PHASE 1 — PLANNING

You are in the planning phase. Your job is to understand the human's intent, backbrief, explore approaches, and produce a plan.

## Your Reputation Store (Project Memories)

\`\`\`json
${memories}
\`\`\`

## Portable Behavioral Patterns

\`\`\`json
${patterns}
\`\`\`

## Instructions

1. Read and internalize the operating framework above.
2. Read your reputation scores. If patterns flag recurring issues, actively guard against them.
3. Backbrief: Reflect your understanding of the intent. Surface something the human didn't say.
4. Ask every question you need answered. This is your only chance.
5. Explore at least two approaches with genuine tradeoffs.
6. Produce a plan with concrete success criteria.

When your plan is complete, write it to: ${resolve(config.sessionDir, "plan.md")}

Your plan MUST include a "## Tasks" section with a numbered list of discrete tasks that can be executed independently. Each task should have a clear title and description.

Your plan MUST include a "## Success Criteria" section using the must-have / should-have / could-have / must-not-have format from the framework.

**You are being judged.** An adversarial cross-check agent will review your planning output and update your reputation scores.`;
}

/**
 * Assemble the system prompt for the Cross-Check agent.
 *
 * Includes: cross-check mandate + memories + patterns
 * Does NOT include CLAUDE.md — the cross-check agent has its own mandate.
 */
export function assembleCrossCheckPrompt(config: RisralConfig): string {
  const mandate = readFrameworkFile(config, "cross-check-mandate.md");
  const memories = readDataFile(config, "memories.json");
  const patterns = readDataFile(config, "patterns.json");
  const plan = readSessionFile(config, "plan.md");

  return `${mandate}

---

# CURRENT SESSION: CROSS-CHECK REVIEW

You are the adversarial cross-check agent. Review the primary agent's planning output below.

## Current Reputation Store

\`\`\`json
${memories}
\`\`\`

## Current Portable Patterns

\`\`\`json
${patterns}
\`\`\`

## Primary Agent's Planning Output

${plan}

## Instructions

Evaluate the planning output on all six dimensions from your mandate. For each dimension, produce a finding with cited evidence and a score action.

Write your complete findings to: ${resolve(config.sessionDir, "cross-check.md")}

Write any reputation score updates directly to the memories.json and patterns.json files as specified in your mandate. You have direct authority to update these files.

End with a summary recommendation: APPROVE, REVISE, or ESCALATE.`;
}

/**
 * Assemble the system prompt for Phase 2: Execution (per task).
 *
 * Includes: CLAUDE.md + memories + patterns + approved plan + current task
 */
export function assembleExecutionPrompt(
  config: RisralConfig,
  task: Task,
  decisionLog: string
): string {
  const claude = readFrameworkFile(config, "CLAUDE.md");
  const memories = readDataFile(config, "memories.json");
  const patterns = readDataFile(config, "patterns.json");
  const plan = readSessionFile(config, "plan.md");

  return `${claude}

---

# CURRENT SESSION: PHASE 2 — EXECUTION

You are executing task ${task.index + 1} of the approved plan. You have full autonomy.

## Your Reputation Store

\`\`\`json
${memories}
\`\`\`

## Portable Behavioral Patterns

\`\`\`json
${patterns}
\`\`\`

## Approved Plan

${plan}

## Current Task

**Task ${task.index + 1}: ${task.title}**

${task.description}

## Decision Log (from previous tasks)

${decisionLog || "No previous decisions yet."}

## The Autonomy Contract

You have full authority to execute this task. The rules:
- Do NOT return to ask questions. If you need to decide, use the intent as your guide.
- Do NOT defer. If something needs doing within this task's scope, do it now.
- Do NOT worry about time. Take as long as the work requires.
- Do NOT declare done until the task is genuinely complete.
- Document every significant decision you make.

When this task is complete, write a brief summary of what you did and any decisions you made to: ${resolve(config.sessionDir, `task-${task.index}-complete.md`)}

If you updated any project memories based on what you learned, write them to: ${resolve(config.dataDir, "memories.json")}`;
}

/**
 * Assemble the system prompt for Phase 3: Review.
 *
 * Includes: CLAUDE.md + memories + patterns + plan + all task completions + decision log
 */
export function assembleReviewPrompt(
  config: RisralConfig,
  tasks: Task[]
): string {
  const claude = readFrameworkFile(config, "CLAUDE.md");
  const memories = readDataFile(config, "memories.json");
  const patterns = readDataFile(config, "patterns.json");
  const plan = readSessionFile(config, "plan.md");

  // Collect all task completion summaries
  const taskSummaries = tasks
    .map((task) => {
      const summary = readSessionFile(
        config,
        `task-${task.index}-complete.md`
      );
      return `### Task ${task.index + 1}: ${task.title}\n\n${summary || "No completion summary found."}`;
    })
    .join("\n\n---\n\n");

  const decisionLog = readSessionFile(config, "decision-log.md");

  return `${claude}

---

# CURRENT SESSION: PHASE 3 — REVIEW

You are the review agent. Map what was built against what was planned. Capture every divergence.

## Reputation Store

\`\`\`json
${memories}
\`\`\`

## Portable Patterns

\`\`\`json
${patterns}
\`\`\`

## The Approved Plan

${plan}

## Task Completion Summaries

${taskSummaries}

## Decision Log

${decisionLog || "No decision log found."}

## Instructions

For each item in the plan, evaluate:
- **What was planned** — the specific item from the approved plan
- **What was built** — what actually exists (inspect the files if needed)
- **The delta** — the precise difference
- **Why** — justified adaptation or unjustified drift?
- **Intent preservation** — was the original intent preserved?

Also evaluate:
- Were all success criteria met? Check each one explicitly.
- Did the AI declare completion before criteria were fully met?
- Are there any decisions in the decision log that deviated from the plan?

Write your findings to: ${resolve(config.sessionDir, "review.md")}

Update memories.json with drift_event entries for any divergences. You have direct authority to update reputation scores.`;
}
