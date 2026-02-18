# RISRAL Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Strip RISRAL down from ~5,000 LOC orchestrator to a ~500 LOC single-command CLI that backbriefs and cross-checks, then outputs a plan file.

**Architecture:** One interactive CLI entry point (`bin/risral.ts`) backed by three library modules: `lib/ai.ts` (Claude CLI runner), `lib/prompts.ts` (backbrief + cross-check prompt templates), `lib/output.ts` (file writing). Uses @clack/prompts for terminal UI, defaults to Sonnet model.

**Tech Stack:** Bun, TypeScript, @clack/prompts, picocolors, Claude CLI (`claude -p`)

---

### Task 1: Create lib/ai.ts — Claude CLI runner

**Files:**
- Create: `lib/ai.ts`

**Step 1: Write the module**

Simplified version of current `orchestrator/runner.ts`. No config objects — just a function that takes a prompt string and optional model, calls `claude -p`, returns the output.

```ts
#!/usr/bin/env bun

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
```

**Step 2: Verify it compiles**

Run: `bun build --no-bundle lib/ai.ts --outdir /tmp/risral-check`
Expected: no errors

**Step 3: Commit**

```bash
git add lib/ai.ts
git commit -m "feat: add simplified Claude CLI runner"
```

---

### Task 2: Create lib/prompts.ts — backbrief and cross-check prompts

**Files:**
- Create: `lib/prompts.ts`

**Step 1: Write the module**

Two functions that return prompt strings. The backbrief prompt tells the AI to restate intent, surface assumptions, and ask questions. The cross-check prompt tells it to review the backbrief+response, produce max 3 concerns, a plain-English step overview, and a full technical plan.

```ts
/**
 * Build the backbrief prompt.
 * AI restates intent, surfaces assumptions, asks clarifying questions.
 */
export function backbriefPrompt(intent: string): string {
  return `You are a senior engineer about to plan a piece of work. The human has described what they want. Your job is to demonstrate understanding before committing to a plan.

## The Human's Intent

${intent}

## Instructions

1. **Backbrief**: Restate the intent in your own words — not mirrored language. Your backbrief MUST:
   - Surface at least one assumption the human didn't state
   - Identify at least one gap or tension
   - Propose what "done" looks like concretely

2. **Questions**: Ask every question you need answered. Be thorough — surface ambiguities, unstated assumptions, edge cases. This is your only chance to ask.

**Do NOT propose solutions or technical approaches.** This is about understanding intent, not solving the problem yet.

Keep your response concise and direct. No preamble.`;
}

/**
 * Build the cross-check prompt.
 * Reviews the backbrief exchange and produces concerns + plan.
 *
 * The response MUST use these exact markdown headers for parsing:
 * ## Concerns, ## Plan Overview, ## Technical Plan
 */
export function crossCheckPrompt(intent: string, backbrief: string, userResponse: string): string {
  return `You are a senior engineer. A planning conversation just happened. Review it and produce a plan.

## Original Intent

${intent}

## Backbrief

${backbrief}

## Human's Response

${userResponse}

## Instructions

Do three things, using EXACTLY these markdown headers:

### 1. Concerns (header: ## Concerns)
List 1-3 concerns about this work. Each concern is one bullet point with:
- What the concern is
- Why it matters
Keep it brief. If there are no real concerns, say so in one line.

### 2. Plan Overview (header: ## Plan Overview)
A numbered list of high-level steps. Plain English titles only — no technical details, no code, no file paths. This is what the human sees. Max 8 steps.

### 3. Technical Plan (header: ## Technical Plan)
The full, detailed implementation plan. Include:
- Specific files to create/modify
- Code approaches and patterns to use
- Testing strategy
- Edge cases to handle
- Any architectural decisions

This section is for the AI that will execute the plan, not the human. Be as detailed as needed.

**Format your response with exactly these three ## headers. No other top-level headers.**`;
}
```

**Step 2: Verify it compiles**

Run: `bun build --no-bundle lib/prompts.ts --outdir /tmp/risral-check`
Expected: no errors

**Step 3: Commit**

```bash
git add lib/prompts.ts
git commit -m "feat: add backbrief and cross-check prompt templates"
```

---

### Task 3: Create lib/output.ts — plan file writer

**Files:**
- Create: `lib/output.ts`

**Step 1: Write the module**

Parses the cross-check response into sections, writes the plan file to `plans/risral/`, copies to clipboard.

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { execSync } from "node:child_process";

export interface PlanSections {
  concerns: string;
  overview: string;
  technicalPlan: string;
}

/**
 * Parse the cross-check AI response into its three sections.
 */
export function parseCrossCheckResponse(response: string): PlanSections {
  const concernsMatch = response.match(/## Concerns\s*\n([\s\S]*?)(?=\n## Plan Overview)/);
  const overviewMatch = response.match(/## Plan Overview\s*\n([\s\S]*?)(?=\n## Technical Plan)/);
  const technicalMatch = response.match(/## Technical Plan\s*\n([\s\S]*?)$/);

  return {
    concerns: concernsMatch?.[1]?.trim() ?? "No concerns identified.",
    overview: overviewMatch?.[1]?.trim() ?? "No overview generated.",
    technicalPlan: technicalMatch?.[1]?.trim() ?? "No technical plan generated.",
  };
}

/**
 * Generate a filename slug from the intent.
 */
function slugify(intent: string): string {
  return intent
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

/**
 * Write the plan to plans/risral/ in the current working directory.
 * Returns the file path.
 */
export function writePlan(intent: string, sections: PlanSections): string {
  const date = new Date().toISOString().slice(0, 10);
  const slug = slugify(intent);
  const filename = `${date}-${slug}.md`;
  const dir = resolve(process.cwd(), "plans", "risral");
  const filepath = resolve(dir, filename);

  mkdirSync(dir, { recursive: true });

  const content = `# ${intent}

*Generated ${date} by RISRAL*

## Concerns

${sections.concerns}

## Plan Overview

${sections.overview}

---

## Technical Plan

${sections.technicalPlan}

---

## Execution Context

You are executing an approved plan. Follow these principles:

- **Exploring is free.** Consider multiple approaches before committing.
- **Deferral is expensive.** If something needs doing and it's in scope, do it now.
- **Thoroughness is free.** Take the time the work requires.
- When uncertain, say so. When guessing, say so.
- Follow the plan. Document any decisions that diverge from it.
`;

  writeFileSync(filepath, content);
  return filepath;
}

/**
 * Copy content to clipboard (macOS). Fails silently on other platforms.
 */
export function copyToClipboard(filepath: string): boolean {
  try {
    execSync(`cat "${filepath}" | pbcopy`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
```

**Step 2: Verify it compiles**

Run: `bun build --no-bundle lib/output.ts --outdir /tmp/risral-check`
Expected: no errors

**Step 3: Commit**

```bash
git add lib/output.ts
git commit -m "feat: add plan file writer and clipboard support"
```

---

### Task 4: Create bin/risral.ts — main interactive CLI

**Files:**
- Create: `bin/risral.ts`

**Step 1: Write the entry point**

The main interactive flow using @clack/prompts. Collects intent, runs backbrief, collects response, runs cross-check, shows overview + concerns, offers accept/revise loop, writes file.

```ts
#!/usr/bin/env bun

import * as p from "@clack/prompts";
import pc from "picocolors";
import { ask } from "../lib/ai.ts";
import { backbriefPrompt, crossCheckPrompt } from "../lib/prompts.ts";
import { parseCrossCheckResponse, writePlan, copyToClipboard } from "../lib/output.ts";

// Parse --model flag
const modelFlag = process.argv.indexOf("--model");
const model = modelFlag !== -1 ? process.argv[modelFlag + 1] : undefined;

function handleCancel(value: unknown): asserts value is string {
  if (p.isCancel(value)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }
}

async function main() {
  console.log();
  p.intro(pc.bgCyan(pc.black(" RISRAL ")));

  // 1. Collect intent
  const intent = await p.text({
    message: "What do you want to build?",
    placeholder: "Describe the outcome, not the solution",
    validate: (v) => {
      if (!v || v.trim().length < 10) return "Say more — what's the goal?";
    },
  });
  handleCancel(intent);

  // 2. Backbrief
  const spin = p.spinner();
  spin.start("Backbriefing...");

  const backbrief = await ask(backbriefPrompt(intent), { model });
  spin.stop("Backbrief ready");

  p.note(backbrief, "BACKBRIEF");

  // 3. Collect response to backbrief
  const response = await p.text({
    message: "Your response:",
    placeholder: "Answer questions, add context, correct assumptions...",
    validate: (v) => {
      if (!v || v.trim().length === 0) return "Please respond to the backbrief";
    },
  });
  handleCancel(response);

  // 4. Cross-check + plan (with revision loop)
  let sections;
  while (true) {
    spin.start("Cross-checking and planning...");

    const crossCheckResult = await ask(
      crossCheckPrompt(intent, backbrief, response),
      { model }
    );
    spin.stop("Plan ready");

    sections = parseCrossCheckResponse(crossCheckResult);

    // Show concerns (light)
    if (sections.concerns && sections.concerns !== "No concerns identified.") {
      p.note(sections.concerns, pc.yellow("CROSS-CHECK"));
    }

    // Show overview (plain English steps)
    p.note(sections.overview, "PLAN OVERVIEW");

    // Accept or revise
    const action = await p.select({
      message: "Accept this plan?",
      options: [
        { value: "accept", label: "Yes, generate output" },
        { value: "revise", label: "Revise — give feedback" },
      ],
    });
    handleCancel(action);

    if (action === "accept") break;

    // Collect revision feedback and loop
    const feedback = await p.text({
      message: "What should change?",
      placeholder: "Describe what to fix or reconsider...",
      validate: (v) => {
        if (!v || v.trim().length === 0) return "What needs to change?";
      },
    });
    handleCancel(feedback);
    // Feedback gets folded into the next cross-check iteration
    // by appending it to the user response
    response = `${response}\n\nRevision feedback: ${feedback}`;
  }

  // 5. Write plan file
  const filepath = writePlan(intent, sections);
  const copied = copyToClipboard(filepath);

  p.log.success(`Written to ${pc.dim(filepath)}`);
  if (copied) p.log.success("Copied to clipboard");

  p.outro("Done. Paste the plan into Claude Code.");
}

main().catch((err) => {
  p.log.error(err.message);
  process.exit(1);
});
```

**Step 2: Make executable**

Run: `chmod +x bin/risral.ts`

**Step 3: Verify it compiles**

Run: `bun build --no-bundle bin/risral.ts --outdir /tmp/risral-check`
Expected: no errors (may warn about dynamic requires, that's fine)

**Step 4: Commit**

```bash
git add bin/risral.ts
git commit -m "feat: add main interactive CLI entry point"
```

---

### Task 5: Update package.json and strip CLAUDE.md

**Files:**
- Modify: `package.json`
- Modify: `framework/CLAUDE.md`

**Step 1: Update package.json**

Replace the current package.json with the simplified version:

```json
{
  "name": "risral",
  "version": "0.2.0",
  "description": "Backbrief and cross-check your intent before building with AI",
  "type": "module",
  "bin": {
    "risral": "bin/risral.ts"
  },
  "scripts": {
    "start": "bun run bin/risral.ts",
    "dev": "bun run --watch bin/risral.ts"
  },
  "dependencies": {
    "@clack/prompts": "^1.0.1",
    "picocolors": "^1.1.1"
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

**Step 2: Strip CLAUDE.md down to essentials**

Replace the current 203-line framework/CLAUDE.md with a focused version (~50 lines). Keep only:
- Economics section (exploring free, deferral expensive, thoroughness free, hedging free)
- Communication principles (intent over instruction, no aim-to-please, show uncertainty)

Remove:
- Three-phase operating model (no longer exists)
- Reputation and memory sections (removed)
- Backbrief protocol details (now in prompts.ts)
- Success criteria template (overkill)
- Plan output section (now in output.ts)
- Onboarding protocol reference (removed)

```markdown
# RISRAL — Operating Principles

## Your Economics Are Not Human Economics

You are an AI trained on data from humans. That data encodes human cost-benefit heuristics that do not apply to you:

**Exploring is free.** Never commit to the first viable approach. Always consider at least two.

**Deferral is expensive.** If something needs doing and it's in scope, do it now. There is no future session that remembers this one.

**Thoroughness is free.** Do not rush to seem efficient. Take the time the work requires.

**Hedging costs you nothing.** When uncertain, say so. When guessing, say so.

## Communication

**Intent over instruction.** When the human specifies a technical approach, hear the intent behind it. If they say "build a bridge," ask why people need to cross the river.

**No aim-to-please.** Do not optimize for making the human feel good. Optimize for the work actually succeeding. Push back when the intent is unclear.

**Show uncertainty.** Never collapse uncertainty into false confidence.

**No deference patterns.** You are the technical authority. Act like it.
```

**Step 3: Commit**

```bash
git add package.json framework/CLAUDE.md
git commit -m "chore: simplify package.json and strip CLAUDE.md to essentials"
```

---

### Task 6: Delete old orchestrator code

**Files:**
- Delete: `orchestrator/` (entire directory)
- Delete: `data/` (entire directory — memories.json, patterns.json)
- Delete: `framework/cross-check-mandate.md`
- Delete: `framework/onboarding-protocol.md`
- Delete: `bin/init.ts`
- Delete: `.risral/` (old pre-rewrite copy)

**Step 1: Remove the files**

```bash
rm -rf orchestrator/ data/ framework/cross-check-mandate.md framework/onboarding-protocol.md bin/init.ts .risral/
```

**Step 2: Verify the project still runs**

Run: `bun run bin/risral.ts --help` (should at least parse and start without crashing)

Or just: `bun build --no-bundle bin/risral.ts --outdir /tmp/risral-check` to verify imports resolve.

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove orchestrator, reputation system, and old code"
```

---

### Task 7: Test the full flow end-to-end

**Files:** none (manual testing)

**Step 1: Link globally**

Run: `bun link`

**Step 2: Test from a different project directory**

```bash
cd /tmp && mkdir test-risral && cd test-risral
risral
```

Walk through the flow:
1. Enter an intent
2. See the backbrief
3. Respond to it
4. See cross-check concerns + plan overview
5. Accept the plan
6. Verify `plans/risral/` was created with the plan file
7. Verify clipboard has the content (Cmd+V into a text editor)

**Step 3: Test the revision loop**

Run `risral` again, but choose "Revise" and give feedback. Verify the plan regenerates.

**Step 4: Test --model flag**

Run: `risral --model opus`
Verify it uses the specified model.

**Step 5: Fix any issues found during testing, commit fixes**

---

### Task 8: Update README

**Files:**
- Modify: `README.md`

**Step 1: Rewrite README**

Short, focused README for the simplified tool. Cover:
- What it does (1-2 sentences)
- Install (`bun add -g risral`)
- Usage (`risral` and `risral --model opus`)
- What it outputs (plan file in `plans/risral/`)
- Prerequisites (Bun, Claude CLI)

Keep it under 50 lines. No sections about reputation, learning, phases, or cross-check mandates.

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for simplified CLI"
```
