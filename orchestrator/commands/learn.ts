// RISRAL — Learn Command
//
// Feeds execution outcomes back into the reputation system.
// The human reports how plan execution went, and a Claude invocation
// updates memories.json and patterns.json based on that feedback.
//
// Does not require an active session — can be run anytime.
// If a session exists, its context (plan output) is loaded for richer updates.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RisralConfig } from "../types.ts";
import { assembleLearnPrompt, type LearnFeedback } from "../prompt.ts";
import { runClaude } from "../runner.ts";
import * as ui from "../ui.ts";

export async function runLearnCommand(config: RisralConfig): Promise<void> {
  ui.intro();
  ui.phaseIntro("Learn", "Feed execution outcomes into the reputation system");

  // Show session context if available
  const planOutputPath = resolve(config.sessionDir, "plan-output.md");
  const hasSession = existsSync(planOutputPath);

  if (hasSession) {
    const intentPath = resolve(config.sessionDir, "intent.md");
    if (existsSync(intentPath)) {
      const intent = readFileSync(intentPath, "utf-8");
      ui.showContent("Session Intent", intent.trim());
    }
    ui.success("Session context found — it will be included for richer reputation updates.");
  } else {
    ui.info("No active session found. You can still record learnings.");
  }

  // --- Collect feedback ---

  // 1. How did execution go?
  const outcomeResult = await ui.collectFeedback(
    "How did execution go? Describe the outcome."
  );
  ui.handleCancel(outcomeResult);
  const outcome = outcomeResult as string;

  if (!outcome.trim()) {
    ui.warn("No outcome provided. Nothing to learn from.");
    ui.outro("Done");
    return;
  }

  // 2. Did anything drift?
  const driftResult = await ui.collectFeedback(
    "Did anything drift from the plan? What and why? (Press enter to skip)",
    { required: false }
  );
  ui.handleCancel(driftResult);
  const drift = (driftResult as string) || "";

  // 3. False beliefs?
  const falseBeliefsResult = await ui.collectFeedback(
    "Any false beliefs discovered? Things the plan assumed that turned out wrong? (Press enter to skip)",
    { required: false }
  );
  ui.handleCancel(falseBeliefsResult);
  const falseBeliefs = (falseBeliefsResult as string) || "";

  const feedback: LearnFeedback = {
    outcome: outcome.trim(),
    drift: drift.trim(),
    falseBeliefs: falseBeliefs.trim(),
  };

  // --- Run Claude to update reputation store ---
  ui.startSpinner("Updating reputation store...");

  const systemPrompt = assembleLearnPrompt(config, feedback);

  const result = await runClaude({
    systemPrompt,
    userPrompt: "Read the execution feedback above and update the reputation store (memories.json and patterns.json). Summarize your changes.",
    workingDir: config.projectDir,
    additionalDirs: [config.dataDir, config.sessionDir],
    model: config.model,
    maxBudget: config.maxBudgetPerInvocation,
    skipPermissions: config.skipPermissions,
  });

  ui.stopSpinner("Reputation store updated");

  if (result.exitCode !== 0) {
    ui.warn(`Learn invocation exited with code ${result.exitCode}`);
    if (result.stderr.trim()) {
      ui.error(result.stderr.trim().slice(0, 500));
    }
  }

  // Show the summary of what changed
  if (result.stdout.trim()) {
    ui.showContent("Changes", result.stdout.trim());
  } else {
    ui.info("Claude completed but produced no summary output.");
  }

  ui.outro("Done");
}
