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
  let userResponse = await p.text({
    message: "Your response:",
    placeholder: "Answer questions, add context, correct assumptions...",
    validate: (v) => {
      if (!v || v.trim().length === 0) return "Please respond to the backbrief";
    },
  });
  handleCancel(userResponse);

  // 4. Cross-check + plan (with revision loop)
  let sections;
  while (true) {
    spin.start("Cross-checking and planning...");

    const crossCheckResult = await ask(
      crossCheckPrompt(intent, backbrief, userResponse),
      { model },
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
        { value: "accept" as const, label: "Yes, generate output" },
        { value: "revise" as const, label: "Revise — give feedback" },
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
    userResponse = `${userResponse}\n\nRevision feedback: ${feedback}`;
  }

  // 5. Write plan file
  const filepath = writePlan(intent, sections!);
  const copied = copyToClipboard(filepath);

  p.log.success(`Written to ${pc.dim(filepath)}`);
  if (copied) p.log.success("Copied to clipboard");

  p.outro("Done. Paste the plan into Claude Code.");
}

main().catch((err) => {
  p.log.error(err.message);
  process.exit(1);
});
