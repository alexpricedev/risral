// RISRAL Orchestrator — Human I/O
//
// Terminal-based interaction for human checkpoints.

import { createInterface } from "node:readline";

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Ask the human a question and wait for their response.
 */
export function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Ask for a yes/no confirmation.
 */
export async function confirm(question: string): Promise<boolean> {
  const answer = await ask(`${question} (y/n): `);
  return answer.toLowerCase().startsWith("y");
}

/**
 * Ask for multi-line input (terminated by an empty line).
 */
export async function askMultiline(prompt: string): Promise<string> {
  console.log(prompt);
  console.log("(Enter an empty line when done)\n");

  const lines: string[] = [];

  while (true) {
    const line = await ask("");
    if (line === "") break;
    lines.push(line);
  }

  return lines.join("\n");
}

/**
 * Display a phase header in the terminal.
 */
export function phaseHeader(phase: string, detail?: string): void {
  const separator = "═".repeat(60);
  console.log(`\n${separator}`);
  console.log(`  RISRAL — ${phase}`);
  if (detail) console.log(`  ${detail}`);
  console.log(`${separator}\n`);
}

/**
 * Display a task header.
 */
export function taskHeader(index: number, total: number, title: string): void {
  console.log(`\n┌─ Task ${index + 1}/${total}: ${title}`);
  console.log(`└${"─".repeat(58)}\n`);
}

/**
 * Display a status message.
 */
export function status(message: string): void {
  console.log(`  → ${message}`);
}

/**
 * Display a warning.
 */
export function warn(message: string): void {
  console.log(`  ⚠ ${message}`);
}

/**
 * Display a success message.
 */
export function success(message: string): void {
  console.log(`  ✓ ${message}`);
}

/**
 * Close the readline interface (call at exit).
 */
export function close(): void {
  rl.close();
}
