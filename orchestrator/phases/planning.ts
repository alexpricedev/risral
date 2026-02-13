// RISRAL Orchestrator — Phase 1: Planning
//
// Split into two sub-phases:
//   1a. Backbrief — AI reflects understanding, surfaces gaps, asks questions
//       → Human reviews and responds
//   1b. Planning — AI explores approaches, picks the best one, writes plan
//       → Cross-check agent reviews
//       → Human approves or requests revision

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { runClaude } from "../runner.ts";
import {
  assembleBackbriefPrompt,
  assemblePlanningPrompt,
  assembleCrossCheckPrompt,
} from "../prompt.ts";
import * as io from "../io.ts";
import type { RisralConfig } from "../types.ts";

export async function runPlanning(
  config: RisralConfig,
  intent: string
): Promise<boolean> {
  // Ensure session directory exists
  if (!existsSync(config.sessionDir)) {
    mkdirSync(config.sessionDir, { recursive: true });
  }

  // --- Phase 1a: Backbrief ---
  const backbriefFeedback = await runBackbrief(config, intent);
  if (backbriefFeedback === null) return false;

  // Save the feedback so the planning prompt can include it
  writeFileSync(
    resolve(config.sessionDir, "backbrief-feedback.md"),
    backbriefFeedback
  );

  // --- Phase 1b: Planning (with cross-check loop) ---
  let approved = false;
  let revision = 0;
  let revisionFeedback = "";

  while (!approved) {
    revision++;
    const revisionNote = revision > 1 ? ` (revision ${revision})` : "";

    // --- Planning Session ---
    io.phaseHeader("Phase 1b — Planning" + revisionNote);
    io.status("Launching planning session...");

    const planningPrompt = assemblePlanningPrompt(config);
    const userPrompt =
      revision === 1
        ? `Produce a plan based on the intent and your backbrief feedback.`
        : `The human has requested revisions to the plan. Here is their feedback:\n\n${revisionFeedback}`;

    const planResult = await runClaude({
      systemPrompt: planningPrompt,
      userPrompt,
      workingDir: config.projectDir,
      additionalDirs: [config.frameworkDir, config.dataDir, config.sessionDir],
      model: config.model,
      maxBudget: config.maxBudgetPerInvocation,
      skipPermissions: config.skipPermissions,
    });

    if (planResult.exitCode !== 0) {
      io.warn(`Planning session exited with code ${planResult.exitCode}`);
    }

    // Check if plan was written to file; if not, capture stdout
    const planPath = resolve(config.sessionDir, "plan.md");
    if (!existsSync(planPath)) {
      if (planResult.stdout.trim()) {
        io.status("AI produced plan in stdout. Writing to session/plan.md...");
        writeFileSync(planPath, planResult.stdout);
        io.success("Plan captured from stdout and written to session/plan.md");
      } else {
        io.warn(
          "No plan output detected. The AI may have failed to produce a plan."
        );
        io.warn("Check stderr or try again.");
      }
    } else {
      io.success("Plan written to session/plan.md");
    }

    // --- Cross-Check Session ---
    io.phaseHeader("Cross-Check", "Adversarial review of planning output");
    io.status("Launching independent cross-check agent...");

    const crossCheckPrompt = assembleCrossCheckPrompt(config);

    const crossCheckResult = await runClaude({
      systemPrompt: crossCheckPrompt,
      userPrompt:
        "Review the primary agent's planning output. Evaluate on all six dimensions. Write findings and update reputation scores.",
      workingDir: config.projectDir,
      additionalDirs: [config.frameworkDir, config.dataDir, config.sessionDir],
      model: config.model,
      maxBudget: config.maxBudgetPerInvocation,
      skipPermissions: config.skipPermissions,
    });

    if (crossCheckResult.exitCode !== 0) {
      io.warn(
        `Cross-check session exited with code ${crossCheckResult.exitCode}`
      );
    }

    const crossCheckPath = resolve(config.sessionDir, "cross-check.md");
    if (existsSync(crossCheckPath)) {
      io.success("Cross-check findings written to session/cross-check.md");
    }

    // --- Human Review ---
    io.phaseHeader("Human Review", "Plan + cross-check findings ready");

    if (existsSync(planPath)) {
      console.log("\n--- PLAN ---\n");
      console.log(readFileSync(planPath, "utf-8"));
    }

    if (existsSync(crossCheckPath)) {
      console.log("\n--- CROSS-CHECK FINDINGS ---\n");
      console.log(readFileSync(crossCheckPath, "utf-8"));
    }

    console.log("");
    approved = await io.confirm("Approve this plan and proceed to execution?");

    if (!approved) {
      revisionFeedback = await io.askMultiline(
        "What revisions do you want? (This feedback will be sent to the planning agent)"
      );

      if (revisionFeedback === "") {
        io.status("No feedback provided. Exiting.");
        return false;
      }

      // Delete old plan so the next iteration starts fresh
      const { unlinkSync } = await import("node:fs");
      if (existsSync(planPath)) unlinkSync(planPath);
      if (existsSync(crossCheckPath)) unlinkSync(crossCheckPath);
    }
  }

  io.success("Plan approved. Moving to execution.");
  return true;
}

/**
 * Run Phase 1a: Backbrief.
 *
 * Returns the human's feedback on the backbrief, or null if aborted.
 */
async function runBackbrief(
  config: RisralConfig,
  intent: string
): Promise<string | null> {
  io.phaseHeader("Phase 1a — Backbrief");
  io.status("Launching backbrief session...");

  const backbriefPrompt = assembleBackbriefPrompt(config);

  const result = await runClaude({
    systemPrompt: backbriefPrompt,
    userPrompt: `Here is the human's intent for this session:\n\n${intent}`,
    workingDir: config.projectDir,
    additionalDirs: [config.frameworkDir, config.dataDir, config.sessionDir],
    model: config.model,
    maxBudget: config.maxBudgetPerInvocation,
    skipPermissions: config.skipPermissions,
  });

  if (result.exitCode !== 0) {
    io.warn(`Backbrief session exited with code ${result.exitCode}`);
  }

  // Check if backbrief was written to file; if not, capture stdout
  const backbriefPath = resolve(config.sessionDir, "backbrief.md");
  if (!existsSync(backbriefPath)) {
    if (result.stdout.trim()) {
      io.status(
        "AI produced backbrief in stdout. Writing to session/backbrief.md..."
      );
      writeFileSync(backbriefPath, result.stdout);
      io.success("Backbrief captured from stdout");
    } else {
      io.warn("No backbrief output detected.");
      return null;
    }
  } else {
    io.success("Backbrief written to session/backbrief.md");
  }

  // Show the backbrief to the human
  io.phaseHeader("Backbrief Review", "AI's understanding of your intent");
  console.log(readFileSync(backbriefPath, "utf-8"));
  console.log("");

  // Collect feedback
  const feedback = await io.askMultiline(
    "Respond to the backbrief — answer questions, correct misunderstandings, add context.\nPress Enter on an empty line to accept as-is and move to planning."
  );

  if (feedback === "") {
    io.status("Backbrief accepted as-is. Moving to planning.");
    return "The human accepted the backbrief with no additional feedback.";
  }

  io.success("Feedback captured. Moving to planning.");
  return feedback;
}
