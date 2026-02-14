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
import * as ui from "../ui.ts";
import pc from "picocolors";
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
    ui.phaseIntro("Designing approach" + revisionNote, "Building your plan");

    ui.startSpinner("Designing approach...");

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

    ui.stopSpinner("Plan ready");

    if (planResult.exitCode !== 0) {
      ui.warn(`Planning session exited with code ${planResult.exitCode}`);
    }

    // Check if plan was written to file; if not, capture stdout
    const planPath = resolve(config.sessionDir, "plan.md");
    if (!existsSync(planPath)) {
      if (planResult.stdout.trim()) {
        writeFileSync(planPath, planResult.stdout);
        ui.success("Plan captured and saved");
      } else {
        ui.error("No plan output detected. The AI may have failed to produce a plan.");
        ui.info("Check session logs or try again.");
        return false;
      }
    } else {
      ui.success("Plan saved to session/plan.md");
    }

    // Display the plan
    const planContent = readFileSync(planPath, "utf-8");
    ui.showContent("Plan", planContent, "session/plan.md");

    // --- Cross-Check Session ---
    ui.phaseIntro("Cross-checking", "Adversarial review of the plan");

    ui.startSpinner("Cross-checking plan...");

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

    ui.stopSpinner("Cross-check complete");

    if (crossCheckResult.exitCode !== 0) {
      ui.warn(`Cross-check session exited with code ${crossCheckResult.exitCode}`);
    }

    const crossCheckPath = resolve(config.sessionDir, "cross-check.md");

    if (existsSync(crossCheckPath)) {
      const findings = readFileSync(crossCheckPath, "utf-8");

      // Extract recommendation from cross-check output
      const recommendation = extractRecommendation(findings);
      if (recommendation === "APPROVE") {
        ui.success(`Cross-check: ${pc.bold("APPROVED")}`);
      } else if (recommendation === "REVISE") {
        ui.warn(`Cross-check: ${pc.bold("REVISION REQUESTED")}`);
      } else if (recommendation === "ESCALATE") {
        ui.error(`Cross-check: ${pc.bold("ESCALATED")}`);
      }

      ui.showContent("Cross-Check Findings", findings, "session/cross-check.md");
    } else {
      ui.warn("No cross-check findings file found.");
    }

    // --- Human Review ---
    ui.phaseIntro("Your review", "Plan and cross-check findings are ready");

    const approvalResult = await ui.confirmAction("Approve this plan and proceed to execution?");
    ui.handleCancel(approvalResult);
    approved = approvalResult as boolean;

    if (!approved) {
      const feedback = await ui.collectFeedback(
        "What should be revised? (This feedback will be sent to the planning agent)"
      );
      ui.handleCancel(feedback);
      revisionFeedback = feedback as string;

      if (!revisionFeedback.trim()) {
        ui.info("No feedback provided. Exiting.");
        return false;
      }

      // Delete old plan so the next iteration starts fresh
      const { unlinkSync } = await import("node:fs");
      if (existsSync(planPath)) unlinkSync(planPath);
      if (existsSync(crossCheckPath)) unlinkSync(crossCheckPath);
    }
  }

  ui.success("Plan approved. Moving to execution.");
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
  ui.phaseIntro("Understanding your intent", "AI is analyzing your session intent");

  ui.startSpinner("Understanding your intent...");

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

  ui.stopSpinner("Backbrief ready");

  if (result.exitCode !== 0) {
    ui.warn(`Backbrief session exited with code ${result.exitCode}`);
  }

  // Check if backbrief was written to file; if not, capture stdout
  const backbriefPath = resolve(config.sessionDir, "backbrief.md");
  if (!existsSync(backbriefPath)) {
    if (result.stdout.trim()) {
      writeFileSync(backbriefPath, result.stdout);
      ui.success("Backbrief captured and saved");
    } else {
      ui.error("No backbrief output detected.");
      return null;
    }
  } else {
    ui.success("Backbrief saved to session/backbrief.md");
  }

  // Show the backbrief to the human
  const backbriefContent = readFileSync(backbriefPath, "utf-8");
  ui.showContent("Backbrief", backbriefContent, "session/backbrief.md");

  // Collect feedback
  const feedback = await ui.collectFeedback(
    "Respond to the backbrief — answer questions, correct misunderstandings, add context"
  );
  ui.handleCancel(feedback);
  const feedbackStr = (feedback as string).trim();

  if (feedbackStr === "") {
    ui.info("Backbrief accepted as-is. Moving to planning.");
    return "The human accepted the backbrief with no additional feedback.";
  }

  ui.success("Feedback captured. Moving to planning.");
  return feedbackStr;
}

/**
 * Extract the cross-check recommendation (APPROVE/REVISE/ESCALATE) from findings text.
 * Looks for common patterns in the cross-check output.
 */
function extractRecommendation(findings: string): string | null {
  const upper = findings.toUpperCase();

  // Look for explicit recommendation patterns
  const patterns = [
    /RECOMMEND(?:ATION)?:\s*(APPROVE|REVISE|ESCALATE)/i,
    /VERDICT:\s*(APPROVE|REVISE|ESCALATE)/i,
    /DECISION:\s*(APPROVE|REVISE|ESCALATE)/i,
    /\*\*(APPROVE|REVISE|ESCALATE)\*\*/i,
  ];

  for (const pattern of patterns) {
    const match = findings.match(pattern);
    if (match) return match[1].toUpperCase();
  }

  // Fallback: look for the word appearing prominently
  if (upper.includes("ESCALATE")) return "ESCALATE";
  if (upper.includes("REVISE")) return "REVISE";
  if (upper.includes("APPROVE")) return "APPROVE";

  return null;
}
