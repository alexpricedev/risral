// RISRAL Orchestrator — Phase 3: Review
//
// Launches the review agent in an independent session to map
// output against the plan. Captures drift, updates reputation.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runClaude } from "../runner.ts";
import { assembleReviewPrompt } from "../prompt.ts";
import * as ui from "../ui.ts";
import type { RisralConfig, Task } from "../types.ts";

export async function runReview(
  config: RisralConfig,
  tasks: Task[]
): Promise<void> {
  ui.phaseIntro("Reviewing results", "Mapping execution against the plan");

  const systemPrompt = assembleReviewPrompt(config, tasks);

  ui.startSpinner("Reviewing execution against plan...");

  const result = await runClaude({
    systemPrompt,
    userPrompt:
      "Review the execution output against the approved plan. Map every divergence. Update reputation scores. Check all success criteria.",
    workingDir: config.projectDir,
    additionalDirs: [config.frameworkDir, config.dataDir, config.sessionDir],
    model: config.model,
    maxBudget: config.maxBudgetPerInvocation,
    skipPermissions: config.skipPermissions,
  });

  ui.stopSpinner("Review complete");

  const reviewPath = resolve(config.sessionDir, "review.md");

  if (result.exitCode !== 0) {
    ui.warn(`Review session exited with code ${result.exitCode}`);
  }

  // --- Present findings to human ---

  if (existsSync(reviewPath)) {
    const reviewContent = readFileSync(reviewPath, "utf-8");
    ui.showContent("Review Findings", reviewContent, "session/review.md");
  } else {
    ui.warn("Review agent did not produce review.md");
  }

  // Task summary
  const summary = tasks
    .map((t) => {
      const icon =
        t.status === "completed"
          ? "✓"
          : t.status === "failed"
            ? "✗"
            : "?";
      return `${icon} Task ${t.index + 1}: ${t.title} [${t.status}]`;
    })
    .join("\n");

  ui.showContent("Final Task Status", summary);

  // --- Post-review Q&A ---

  const hasQuestions = await ui.confirmAction(
    "Do you have any questions about the review findings?"
  );
  ui.handleCancel(hasQuestions);

  if (hasQuestions) {
    const planPath = resolve(config.sessionDir, "plan.md");
    const planContent = existsSync(planPath)
      ? readFileSync(planPath, "utf-8")
      : "";
    const reviewContent = existsSync(reviewPath)
      ? readFileSync(reviewPath, "utf-8")
      : "";

    // Allow multiple questions in a loop
    let asking = true;
    while (asking) {
      const question = await ui.collectFeedback("What would you like to know?");
      ui.handleCancel(question);

      ui.startSpinner("Finding answer...");

      const qaResult = await runClaude({
        systemPrompt: `You are answering a question from the human operator about a code review of their project. Be concise and direct. Here are the review findings:\n\n${reviewContent}\n\nHere is the plan that was executed:\n\n${planContent}`,
        userPrompt: question as string,
        workingDir: config.projectDir,
        additionalDirs: [config.frameworkDir, config.dataDir, config.sessionDir],
        model: config.model,
        maxBudget: config.maxBudgetPerInvocation,
        skipPermissions: config.skipPermissions,
      });

      ui.stopSpinner("Answer ready");

      if (qaResult.stdout.trim()) {
        ui.showContent("Answer", qaResult.stdout.trim());
      } else {
        ui.warn("No answer was produced. The review context may be insufficient.");
      }

      const moreQuestions = await ui.confirmAction("Any other questions?");
      ui.handleCancel(moreQuestions);
      asking = moreQuestions as boolean;
    }
  }
}
