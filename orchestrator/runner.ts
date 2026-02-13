// RISRAL Orchestrator — Claude CLI Runner
//
// Spawns Claude CLI processes and collects their output.
// Each invocation is a fresh context — no state carries over
// except through files.

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
 */
export async function runClaude(
  invocation: ClaudeInvocation
): Promise<RunResult> {
  const args = buildArgs(invocation);

  const proc = Bun.spawn(["claude", ...args], {
    cwd: invocation.workingDir,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env },
  });

  // Send the user prompt via stdin
  proc.stdin.write(invocation.userPrompt);
  proc.stdin.end();

  // Stream stdout to terminal while collecting it
  let stdout = "";
  const stdoutReader = proc.stdout.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await stdoutReader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    stdout += chunk;
    process.stdout.write(chunk);
  }

  // Collect stderr
  const stderrText = await new Response(proc.stderr).text();
  if (stderrText) {
    process.stderr.write(stderrText);
  }

  const exitCode = await proc.exited;

  return {
    exitCode,
    stdout,
    stderr: stderrText,
  };
}

function buildArgs(invocation: ClaudeInvocation): string[] {
  const args: string[] = ["-p"];

  // System prompt
  if (invocation.systemPrompt) {
    args.push("--system-prompt", invocation.systemPrompt);
  }

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
