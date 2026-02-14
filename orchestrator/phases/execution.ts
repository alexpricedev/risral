// RISRAL Orchestrator — Phase 2: Execution
//
// Executes each task from the approved plan in its own fresh
// CLI session. Context resets between tasks — CLAUDE.md is
// fully salient at the start of every task.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runClaude } from "../runner.ts";
import { assembleExecutionPrompt } from "../prompt.ts";
import {
  readDecisionLog,
  appendDecisionLog,
} from "../state.ts";
import * as ui from "../ui.ts";
import type { RisralConfig, Task } from "../types.ts";

export async function runExecution(
  config: RisralConfig,
  tasks: Task[]
): Promise<Task[]> {
  ui.phaseIntro("Execution", `${tasks.length} tasks to execute`);

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    task.status = "in_progress";

    ui.info(`Task ${i + 1}/${tasks.length}: ${task.title}`);
    ui.startSpinner("Working...");

    const decisionLog = readDecisionLog(config);
    const systemPrompt = assembleExecutionPrompt(config, task, decisionLog);

    const result = await runClaude({
      systemPrompt,
      userPrompt: `Execute task ${task.index + 1}: ${task.title}\n\n${task.description}\n\nYou have full autonomy. Do not ask questions. Execute to completion.`,
      workingDir: config.projectDir,
      additionalDirs: [config.frameworkDir, config.dataDir, config.sessionDir],
      model: config.model,
      maxBudget: config.maxBudgetPerInvocation,
      skipPermissions: config.skipPermissions,
    });

    // Check for task completion signal
    const completionFile = resolve(
      config.sessionDir,
      `task-${task.index}-complete.md`
    );

    if (existsSync(completionFile)) {
      const summary = readFileSync(completionFile, "utf-8");
      appendDecisionLog(config, task.index, task.title, summary);
      task.status = "completed";
      task.completedAt = new Date().toISOString();
      ui.stopSpinner(`Task ${i + 1} completed`);
      ui.success(task.title);
    } else {
      // Task may have completed without writing the signal file
      // Record what we have from stdout
      if (result.stdout) {
        appendDecisionLog(config, task.index, task.title, result.stdout.slice(-2000));
      }
      task.status = result.exitCode === 0 ? "completed" : "failed";
      task.completedAt = new Date().toISOString();

      if (result.exitCode === 0) {
        ui.stopSpinner(`Task ${i + 1} completed (no summary found)`);
        ui.warn(task.title);
      } else {
        ui.stopSpinner(`Task ${i + 1} failed`);
        ui.error(task.title);
      }
    }
  }

  // Execution summary
  const summaryLines = tasks.map((t) => {
    const icon = t.status === "completed" ? "✓" : t.status === "failed" ? "✗" : "?";
    return `${icon} Task ${t.index + 1}: ${t.title} [${t.status}]`;
  }).join("\n");

  ui.showContent("Execution Summary", summaryLines);

  return tasks;
}
