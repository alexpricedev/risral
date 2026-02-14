// RISRAL Orchestrator — Claude CLI Runner
//
// Spawns Claude CLI processes and collects their output.
// Each invocation is a fresh context — no state carries over
// except through files.
//
// The system prompt and user prompt are combined into a single
// message piped via stdin. This avoids OS argument length limits
// that --system-prompt would hit with large framework files.

import type { ClaudeInvocation } from "./types.ts";

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Run a Claude CLI invocation and wait for it to complete.
 *
 * Uses `claude -p` (print mode) which gives the AI full tool access
 * (Bash, Edit, Read, Write) while running to completion and exiting.
 *
 * System prompt and user prompt are combined and piped via stdin
 * to avoid OS argument length limits.
 */
export async function runClaude(
  invocation: ClaudeInvocation
): Promise<RunResult> {
  const args = buildArgs(invocation);

  // Combine system context and user prompt into one piped message
  const fullPrompt = invocation.systemPrompt
    ? `${invocation.systemPrompt}\n\n---\n\n${invocation.userPrompt}`
    : invocation.userPrompt;

  const proc = Bun.spawn(["claude", ...args], {
    cwd: invocation.workingDir,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env },
  });

  // Pipe the combined prompt via stdin
  proc.stdin.write(fullPrompt);
  proc.stdin.end();

  // Collect stdout silently — no terminal output.
  // Phase handlers manage spinners and decide what to display.
  let stdout = "";
  const stdoutReader = proc.stdout.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await stdoutReader.read();
    if (done) break;
    stdout += decoder.decode(value);
  }

  // Collect stderr silently
  const stderrText = await new Response(proc.stderr).text();

  const exitCode = await proc.exited;

  return {
    exitCode,
    stdout,
    stderr: stderrText,
  };
}

function buildArgs(invocation: ClaudeInvocation): string[] {
  const args: string[] = ["-p"];

  // No --system-prompt flag — system context is piped via stdin
  // combined with the user prompt to avoid argument length limits

  // Model selection
  if (invocation.model) {
    args.push("--model", invocation.model);
  }

  // Budget control
  if (invocation.maxBudget) {
    args.push("--max-budget-usd", invocation.maxBudget.toString());
  }

  // Permission handling
  if (invocation.skipPermissions) {
    args.push("--dangerously-skip-permissions");
  }

  // Tool restrictions
  if (invocation.allowedTools && invocation.allowedTools.length > 0) {
    args.push("--allowed-tools", ...invocation.allowedTools);
  }

  // Additional directories to grant access to
  if (invocation.additionalDirs) {
    for (const dir of invocation.additionalDirs) {
      args.push("--add-dir", dir);
    }
  }

  // Output format
  if (invocation.outputFormat) {
    args.push("--output-format", invocation.outputFormat);
  }

  return args;
}
