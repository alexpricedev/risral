# Intent-Gathering Questions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the cold "What do you want to build?" prompt with a three-step intent-gathering flow: fixed opening question, AI-generated follow-ups, and synthesis.

**Architecture:** Add one new prompt function (`intentQuestionsPrompt`) to `lib/prompts.ts`. Rewrite the intent-collection section of `bin/risral.ts` to use the three-step flow. Everything downstream (backbrief, cross-check, output) stays untouched — the `intent` variable just contains richer content.

**Tech Stack:** TypeScript, Bun, @clack/prompts, Claude CLI via `lib/ai.ts`

---

### Task 1: Add `intentQuestionsPrompt` to `lib/prompts.ts`

**Files:**
- Modify: `lib/prompts.ts` (add new export after existing functions)

**Step 1: Add the new prompt function**

Add this after the `crossCheckPrompt` function (after line 72):

```typescript
/**
 * Build the intent-questions prompt.
 * AI reads the user's situation and generates 2 follow-up questions
 * that surface unstated intent.
 */
export function intentQuestionsPrompt(situation: string): string {
  return `A human described a situation they want to change:

"${situation}"

Generate exactly 2 short, specific follow-up questions that surface unstated intent. Focus on:
- Who benefits and what changes for them
- What "done" looks like concretely
- What's at stake if this doesn't happen

Return ONLY the two questions, one per line. No numbering, no bullets, no preamble.`;
}
```

**Step 2: Commit**

```bash
git add lib/prompts.ts
git commit -m "feat: add intentQuestionsPrompt for AI-generated follow-ups"
```

---

### Task 2: Replace intent collection in `bin/risral.ts`

**Files:**
- Modify: `bin/risral.ts` (rewrite lines 24-32, the "Collect intent" section)

**Step 1: Update the import**

Change line 6 from:
```typescript
import { backbriefPrompt, crossCheckPrompt } from "../lib/prompts.ts";
```
to:
```typescript
import { backbriefPrompt, crossCheckPrompt, intentQuestionsPrompt } from "../lib/prompts.ts";
```

**Step 2: Add a question-parsing helper**

Add this after the `handleCancel` function (after line 18):

```typescript
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
```

**Step 3: Replace the intent-collection block**

Replace the entire "1. Collect intent" section (the `p.text` call, `handleCancel`, and the comment) with:

```typescript
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

  const questionsResponse = await ask(intentQuestionsPrompt(situation), { model });
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
```

**Step 4: Remove the duplicate spinner declaration**

The old code declared `const spin = p.spinner();` on the line after the intent collection. Since we now declare `spin` inside the intent-collection block, change the backbrief section's spinner usage from:

```typescript
  // 2. Backbrief
  const spin = p.spinner();
  spin.start("Backbriefing...");
```

to:

```typescript
  // 2. Backbrief
  spin.start("Backbriefing...");
```

(The `spin` variable is already declared above and @clack/prompts spinners are reusable.)

**Step 5: Commit**

```bash
git add bin/risral.ts
git commit -m "feat: replace single intent prompt with three-step intent-gathering flow"
```

---

### Task 3: Smoke test

**Step 1: Run the CLI**

```bash
bun run start
```

**Step 2: Verify the new flow**

Expected behavior:
1. See "What situation are you trying to change?" (not "What do you want to build?")
2. After answering, spinner shows "Thinking about your intent..."
3. Two follow-up questions appear sequentially
4. After answering both, spinner shows "Backbriefing..."
5. Backbrief appears with richer context (references your situation + answers)
6. Rest of flow works as before

**Step 3: Final commit if any fixes needed**

```bash
git add -A && git commit -m "fix: address smoke test issues"
```
