// RISRAL Orchestrator — Phase 1: Planning
//
// Launches the planning session, collects the plan,
// runs the cross-check, and loops until the human approves.

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { runClaude } from "../runner.ts";
import { assemblePlanningPrompt, assembleCrossCheckPrompt } from "../prompt.ts";
import * as io from "../io.ts";
import type { RisralConfig } from "../types.ts";

export async function runPlanning(
  config: RisralConfig,
  intent: string
): Promise<boolean> {
  let approved = false;
  let revision = 0;

  while (!approved) {
    revision++;
    const revisionNote =
      revision > 1 ? ` (revision ${revision})` : "";

    // --- Planning Session ---
    io.phaseHeader("Phase 1 — Planning" + revisionNote);
    io.status("Launching planning session...");

    const planningPrompt = assemblePlanningPrompt(config);
    const userPrompt =
      revision === 1
        ? `Here is the human's intent for this session:\n\n${intent}`
        : `The human has requested revisions to the plan. Here is their feedback:\n\n${intent}`;

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

    // Check if plan was written to file; if not, capture stdout as the plan
    const planPath = resolve(config.sessionDir, "plan.md");
    if (!existsSync(config.sessionDir)) {
      mkdirSync(config.sessionDir, { recursive: true });
    }

    if (!existsSync(planPath)) {
      if (planResult.stdout.trim()) {
        io.status("AI produced plan in stdout. Writing to session/plan.md...");
        writeFileSync(planPath, planResult.stdout);
        io.success("Plan captured from stdout and written to session/plan.md");
      } else {
        io.warn("No plan output detected. The AI may have failed to produce a plan.");
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
      intent = await io.askMultiline(
        "What revisions do you want? (This feedback will be sent to the planning agent)"
      );

      if (intent === "") {
        io.status("No feedback provided. Exiting.");
        return false;
      }
    }
  }

  io.success("Plan approved. Moving to execution.");
  return true;
}
