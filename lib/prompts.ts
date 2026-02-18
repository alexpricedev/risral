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
