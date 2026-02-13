// RISRAL Orchestrator — Phase 3: Review
//
// Launches the review agent in an independent session to map
// output against the plan. Captures drift, updates reputation.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runClaude } from "../runner.ts";
import { assembleReviewPrompt } from "../prompt.ts";
import * as io from "../io.ts";
import type { RisralConfig, Task } from "../types.ts";

export async function runReview(
  config: RisralConfig,
  tasks: Task[]
): Promise<void> {
  io.phaseHeader("Phase 3 — Review", "Drift detection and reputation scoring");
  io.status("Launching independent review agent...");

  const systemPrompt = assembleReviewPrompt(config, tasks);

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

  const reviewPath = resolve(config.sessionDir, "review.md");

  if (existsSync(reviewPath)) {
    io.success("Review findings written to session/review.md");
  } else {
    io.warn("Review agent did not write review.md");
  }

  if (result.exitCode !== 0) {
    io.warn(`Review session exited with code ${result.exitCode}`);
  }

  // --- Present to Human ---
  io.phaseHeader("Review Complete", "Findings ready for human review");

  if (existsSync(reviewPath)) {
    console.log("\n--- REVIEW FINDINGS ---\n");
    console.log(readFileSync(reviewPath, "utf-8"));
  }

  // Task summary
  console.log("\n--- TASK SUMMARY ---\n");
  for (const task of tasks) {
    const statusIcon =
      task.status === "completed"
        ? "✓"
        : task.status === "failed"
          ? "✗"
          : "?";
    console.log(`  ${statusIcon} Task ${task.index + 1}: ${task.title} [${task.status}]`);
  }
  console.log("");
}
