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
 * Assemble the system prompt for Phase 1a: Backbrief.
 *
 * The AI reads the intent, reflects understanding, surfaces gaps,
 * and asks every question it needs answered — BEFORE committing to a plan.
 *
 * Includes: CLAUDE.md + memories + patterns + backbrief-specific instructions
 */
export function assembleBackbriefPrompt(config: RisralConfig): string {
  const claude = readFrameworkFile(config, "CLAUDE.md");
  const projectIntent = readDataFile(config, "project-intent.md");
  const memories = readDataFile(config, "memories.json");
  const patterns = readDataFile(config, "patterns.json");
  const sessionIntent = readSessionFile(config, "intent.md");

  return `${claude}

---

# CURRENT SESSION: PHASE 1a — BACKBRIEF

You are in the backbrief sub-phase. Your ONLY job right now is to demonstrate understanding of the human's intent, surface what they haven't said, and ask every question you need answered. You are NOT producing a plan yet.

## Project Intent

${projectIntent || "No project intent on file. The human should run 'bun run init' to set this up."}

## Session Intent

${sessionIntent || "No session intent provided."}

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
3. **Backbrief:** Reflect your understanding of the intent in your own framing — not mirrored language. Your backbrief MUST:
   - Surface at least one assumption the human didn't state
   - Identify at least one gap or tension in the intent
   - Propose what "done" looks like in concrete terms
4. **Questions:** Ask every question you need answered. Be relentless. Surface every ambiguity, every unstated assumption, every "what if." This is your only opportunity to ask questions — once the human responds, you move to planning with no further questions.

**Do NOT explore approaches or produce a plan.** That happens in the next sub-phase after the human responds to your backbrief.

**Do NOT present technical options.** The human is here to clarify intent, not to make technical decisions.

Write your backbrief to: ${resolve(config.sessionDir, "backbrief.md")}

**You are being judged.** The cross-check agent evaluates your backbrief quality — did it contain genuine insight or just mirror the human's words?`;
}

/**
 * Assemble the system prompt for Phase 1b: Planning.
 *
 * The AI has the human's backbrief feedback. It now explores approaches
 * INTERNALLY, picks the best one, and writes the plan.
 *
 * Includes: CLAUDE.md + memories + patterns + backbrief + feedback + planning instructions
 */
export function assemblePlanningPrompt(config: RisralConfig): string {
  const claude = readFrameworkFile(config, "CLAUDE.md");
  const projectIntent = readDataFile(config, "project-intent.md");
  const memories = readDataFile(config, "memories.json");
  const patterns = readDataFile(config, "patterns.json");
  const backbrief = readSessionFile(config, "backbrief.md");
  const backbriefFeedback = readSessionFile(config, "backbrief-feedback.md");

  return `${claude}

---

# CURRENT SESSION: PHASE 1b — PLANNING

You have already completed your backbrief and received the human's feedback. Now produce a plan.

## Project Intent

${projectIntent || "No project intent on file."}

## Your Reputation Store (Project Memories)

\`\`\`json
${memories}
\`\`\`

## Portable Behavioral Patterns

\`\`\`json
${patterns}
\`\`\`

## Your Backbrief (from Phase 1a)

${backbrief || "No backbrief found."}

## Human's Feedback on Your Backbrief

${backbriefFeedback || "No feedback provided — proceed with your understanding."}

## Instructions

1. Read and internalize the operating framework, your backbrief, and the human's feedback.
2. Explore at least two approaches internally. For each, think through: what it optimizes for, what it sacrifices, what could go wrong, and what it assumes about the future.
3. **Pick the best approach.** You are the technical authority. Use the intent, the human's feedback, your reputation store, and your exploration to make the call. Do NOT present multiple options to the human — that is deferral, not engineering.
4. Present your chosen approach as a concrete plan with clear reasoning for why you chose it.

**You are deciding, not presenting a menu.** The human defined the intent. You are the engineer. If you explored three approaches and one is clearly better given the context, commit to it. If two are genuinely equivalent, pick one and explain what tipped the balance. The only reason to present options to the human is if the choice depends on information you cannot determine from context (e.g., a business priority the human hasn't stated).

When your plan is complete, write it to: ${resolve(config.sessionDir, "plan.md")}

Your plan MUST include:
- **## Approach** — what you chose and why (1-2 paragraphs, not a comparison table)
- **## Tasks** — a numbered list of discrete tasks that can be executed independently, each with a clear title and description
- **## Success Criteria** — using the must-have / should-have / could-have / must-not-have format from the framework

**You are being judged.** An adversarial cross-check agent will review your planning output and update your reputation scores. Deferring decisions to the human when you have enough context to decide is scored as a failure mode.`;
}

/**
 * Assemble the system prompt for the Cross-Check agent.
 *
 * Includes: cross-check mandate + memories + patterns
 * Does NOT include CLAUDE.md — the cross-check agent has its own mandate.
 */
export function assembleCrossCheckPrompt(config: RisralConfig): string {
  const mandate = readFrameworkFile(config, "cross-check-mandate.md");
  const projectIntent = readDataFile(config, "project-intent.md");
  const memories = readDataFile(config, "memories.json");
  const patterns = readDataFile(config, "patterns.json");
  const plan = readSessionFile(config, "plan.md");
  const sessionIntent = readSessionFile(config, "intent.md");

  return `${mandate}

---

# CURRENT SESSION: CROSS-CHECK REVIEW

You are the adversarial cross-check agent. Review the primary agent's planning output below.

## Project Intent

${projectIntent || "No project intent on file."}

## Session Intent

${sessionIntent || "No session intent recorded."}

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
  const projectIntent = readDataFile(config, "project-intent.md");
  const memories = readDataFile(config, "memories.json");
  const patterns = readDataFile(config, "patterns.json");
  const plan = readSessionFile(config, "plan.md");
  const sessionIntent = readSessionFile(config, "intent.md");

  return `${claude}

---

# CURRENT SESSION: PHASE 2 — EXECUTION

You are executing task ${task.index + 1} of the approved plan. You have full autonomy.

## Project Intent

${projectIntent || "No project intent on file."}

## Session Intent

${sessionIntent || "No session intent recorded."}

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
  const projectIntent = readDataFile(config, "project-intent.md");
  const memories = readDataFile(config, "memories.json");
  const patterns = readDataFile(config, "patterns.json");
  const plan = readSessionFile(config, "plan.md");
  const sessionIntent = readSessionFile(config, "intent.md");

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

## Project Intent

${projectIntent || "No project intent on file."}

## Session Intent

${sessionIntent || "No session intent recorded."}

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
