import { spawn } from "bun";

export interface AiOptions {
  model?: string;
}

const DEFAULT_MODEL = "sonnet";

/**
 * Send a prompt to Claude CLI and return the response text.
 * Uses stdin piping to avoid argument length limits.
 */
export async function ask(prompt: string, options: AiOptions = {}): Promise<string> {
  const model = options.model ?? DEFAULT_MODEL;

  const proc = spawn(["claude", "-p", "--model", model], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });

  proc.stdin.write(prompt);
  proc.stdin.end();

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`Claude CLI failed (exit ${exitCode}): ${stderr}`);
  }

  return stdout.trim();
}
