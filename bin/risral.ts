#!/usr/bin/env bun

import * as p from "@clack/prompts";
import pc from "picocolors";
import { resolve } from "node:path";
import { ask } from "../lib/ai.ts";
import { backbriefPrompt, crossCheckPrompt, intentQuestionsPrompt } from "../lib/prompts.ts";
import { parseCrossCheckResponse, writePlan, copyToClipboard } from "../lib/output.ts";

// Read operating principles once at startup
const principlesPath = resolve(import.meta.dir, "../framework/principles.md");
const principles = await Bun.file(principlesPath).text();

// Parse --model flag
const modelFlag = process.argv.indexOf("--model");
const model = modelFlag !== -1 ? process.argv[modelFlag + 1] : undefined;

function handleCancel(value: unknown): asserts value is string {
  if (p.isCancel(value)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }
}

/**
 * Parse AI-generated questions from a response string.
 * Returns up to 2 non-empty lines, stripped of numbering/bullets.
 * Falls back to a hardcoded question if parsing yields nothing.
 */
function parseQuestions(response: string): string[] {
  const questions = response
    .split("\n")
    .map((line) => line.replace(/^[\d.\-*•)\s]+/, "").trim())
    .filter((line) => line.length > 0 && line.endsWith("?"))
    .slice(0, 2);

  return questions.length > 0
    ? questions
    : ["What does 'done' look like?"];
}

async function main() {
  console.log();
  p.intro(pc.bgCyan(pc.black(" RISRAL ")));

  // 1. Collect intent (three-step flow)

  // Step 1: Fixed opening question
  const situation = await p.text({
    message: "What situation are you trying to change?",
    placeholder: "Describe the problem or outcome, not the solution",
    validate: (v) => {
      if (!v || v.trim().length < 10) return "Say more — what's the situation?";
    },
  });
  handleCancel(situation);

  // Step 2: AI-generated follow-up questions
  const spin = p.spinner();
  spin.start("Thinking about your intent...");

  let questionsResponse: string;
  try {
    questionsResponse = await ask(intentQuestionsPrompt(situation, principles), { model });
  } catch (err) {
    spin.stop("Failed");
    throw err;
  }
  const questions = parseQuestions(questionsResponse);

  spin.stop("Follow-up questions ready");

  const answers: string[] = [];
  for (const question of questions) {
    const answer = await p.text({
      message: question,
      validate: (v) => {
        if (!v || v.trim().length === 0) return "Please answer the question";
      },
    });
    handleCancel(answer);
    answers.push(answer);
  }

  // Step 3: Synthesize into intent
  let intent = `Situation: ${situation}`;
  for (let i = 0; i < questions.length; i++) {
    intent += `\n\nQ: ${questions[i]}\nA: ${answers[i]}`;
  }

  // 2. Backbrief
  spin.start("Backbriefing...");

  let backbrief: string;
  try {
    backbrief = await ask(backbriefPrompt(intent, principles), { model });
  } catch (err) {
    spin.stop("Failed");
    throw err;
  }
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

    let crossCheckResult: string;
    try {
      crossCheckResult = await ask(
        crossCheckPrompt(intent, backbrief, userResponse, principles),
        { model },
      );
    } catch (err) {
      spin.stop("Failed");
      throw err;
    }
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
  const filepath = writePlan(intent, sections!, principles);
  const copied = copyToClipboard(filepath);

  p.log.success(`Written to ${pc.dim(filepath)}`);
  if (copied) p.log.success("Copied to clipboard");

  p.outro("Done. Paste the plan into Claude Code.");
}

main().catch((err) => {
  p.log.error(err.message);
  process.exit(1);
});
