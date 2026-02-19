# Intent-Gathering Questions Design

*2026-02-19*

## Problem

"What do you want to build?" is a cold, open-ended prompt. Users default to specifying instructions ("build me an X") when they should be defining intent ("I need Y to happen because Z"). The README's core insight — *humans give instructions when they should define intent* — isn't reflected in the CLI's first interaction.

## Design

Replace the single text prompt with a three-step intent-gathering flow:

### Step 1: Fixed opening question (no API call)

- Message: "What situation are you trying to change?"
- Placeholder: "Describe the problem or outcome, not the solution"
- Validation: minimum 10 chars

This question is intentionally framed around *situations* and *outcomes*, not features or solutions. It steers users toward intent.

### Step 2: AI-generated follow-ups (one API call)

A new prompt function `intentQuestionsPrompt(situation)` sends the user's first answer to Claude and asks for exactly 2 follow-up questions that surface unstated intent. Focus areas: who benefits, what "done" looks like, what's at stake.

Spinner shows "Thinking about your intent..." during the API call.

Parse response: split on newlines, take first 2 non-empty lines, strip numbering/bullets. Fallback if parsing fails: one hardcoded question — "What does 'done' look like?"

Each question shown as a sequential `p.text()` prompt.

### Step 3: Synthesis (no API call)

All Q&A pairs concatenated into a structured intent block:

```
Situation: <user's first answer>

Q: <follow-up 1>
A: <user's answer 1>

Q: <follow-up 2>
A: <user's answer 2>
```

This replaces the old `intent` string passed to `backbriefPrompt()`. No downstream changes needed.

## Files Changed

- `lib/prompts.ts` — add `intentQuestionsPrompt()` function
- `bin/risral.ts` — replace single text prompt with three-step flow

## Files NOT Changed

- `lib/ai.ts` — no changes
- `lib/output.ts` — no changes
- `framework/CLAUDE.md` — no changes
- Backbrief and cross-check prompts — no changes (they already handle rich intent)
