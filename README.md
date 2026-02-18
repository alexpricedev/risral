# RISRAL

**Backbrief and cross-check your intent before building with AI.**

RISRAL takes your intent, has an AI backbrief it (restate, surface assumptions, ask questions), then cross-checks the plan for gaps before you bring it into Claude Code. One command, no ceremony.

## Install

```bash
# Requires Bun (https://bun.sh) and Claude Code CLI
bun add -g risral
```

## Usage

```bash
risral
```

That's it. You'll be guided through:

1. **Describe your intent** — what you want to build
2. **Review the backbrief** — AI restates your intent, surfaces assumptions, asks questions
3. **Respond** — answer questions, add context, correct assumptions
4. **Review the plan** — cross-check concerns + high-level step overview
5. **Accept or revise** — iterate until you're happy, then generate output

The plan is written to `docs/risral/` in your current directory and copied to your clipboard. Paste it into Claude Code.

### Options

```bash
risral --model opus    # Use a different Claude model (default: sonnet)
```

## What It Outputs

A markdown file in `docs/risral/` containing:

- **Concerns** — 1-3 potential issues the cross-check identified
- **Plan Overview** — numbered high-level steps (plain English)
- **Technical Plan** — detailed implementation spec for the AI
- **Execution Context** — operating principles for Claude Code

## Requirements

- [Bun](https://bun.sh) runtime
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated

---

## The Problem

AI models are O-shaped — vast knowledge across every domain, no experiential filter. Humans are T-shaped — deep in one or two domains, shaped by decades of consequences. When they collaborate, both sides default to patterns that don't work:

- **Humans give instructions when they should define intent.** The more precisely a human specifies *how*, the more faithfully the AI executes — even when the *how* is wrong.
- **AI inherits human economics.** It commits early (as if exploring were expensive), defers fixes (as if deferral saved effort), and projects false confidence (as if reputation were at stake). For an AI, none of these constraints apply.
- **AI has no reputation.** Every session starts at zero. There's no accumulated consequence for being wrong, no scar tissue from past mistakes, no calibrated carefulness built over time.

RISRAL corrects for this by forcing a backbrief (demonstrate understanding before acting) and a cross-check (adversarial review before committing to a plan).

## Theoretical Foundation

RISRAL draws on several converging ideas:

- **Auftragstaktik** (mission-type tactics) — Field Marshal von Moltke's 19th-century insight that alignment and autonomy reinforce each other. Define intent, grant autonomy on action. Mediated through Stephen Bungay's *The Art of Action* and its three gaps: knowledge, alignment, and effects.
- **The Emdash Problem** — The observation that AI benchmark performance outpaces economic impact because models inherit misaligned economics from training data created by humans operating under different constraints.
- **Behavioural economics of intelligence** — T-shaped humans compress, defer, and commit because those decisions are rational given their cost structure. O-shaped AI does the same despite having inverted economics where exploring is free and deferral is expensive.
- **Synthetic reputation** — Since AI lacks persistent memory and accumulated consequences, external mechanisms (backbrief, cross-check, explicit scoring) substitute for the reputation that humans build naturally over time.

---

## License

MIT
