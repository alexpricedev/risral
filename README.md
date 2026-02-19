# RISRAL

**Backbrief and cross-check your intent before building with AI.**

RISRAL takes your intent, has an AI backbrief it (restate, surface assumptions, ask questions), then cross-checks the plan for gaps before you bring it into Claude Code. One command, no ceremony.

## What a Session Looks Like

```
$ risral

┌  RISRAL
│
◆  What situation are you trying to change?
│  Our API has no rate limiting and we're getting hit by bots
│
◇  Thinking about your intent...
│
◆  What breaks first when a bot flood hits — user experience, database, or billing?
│  Billing. We pay per-request to a downstream provider.
│
◆  Who needs to be unaffected by rate limits — just bots, or are power users at risk too?
│  Power users are fine, they do maybe 10 req/min. Bots do 1000+.
│
◇  Backbriefing...
│
│  BACKBRIEF
│  You need request-rate throttling to protect downstream costs.
│  The target is bot traffic (1000+ rpm), not legitimate power users (~10 rpm).
│  Assumption: you want this at the API gateway level, not per-endpoint.
│  Gap: no mention of what should happen to throttled requests — 429? silent drop? queue?
│
│  Questions:
│  - Should throttled requests get a 429 with retry-after, or be silently dropped?
│  - Is there an existing API gateway (nginx, cloudflare) or is this in-app middleware?
│
◆  Your response:
│  429 with retry-after. We use Express directly, no gateway.
│
◇  Cross-checking and planning...
│
│  ⚠ CROSS-CHECK
│  - Express rate limiting middleware (express-rate-limit) handles this well but
│    operates per-process — if you run multiple instances, you'll need a shared
│    store (Redis).
│
│  PLAN OVERVIEW
│  1. Add express-rate-limit middleware with a 100 req/min default
│  2. Configure 429 responses with retry-after headers
│  3. Add Redis store for multi-instance deployments
│  4. Add rate limit bypass for health check endpoints
│  5. Test with load simulation
│
◆  Accept this plan?
│  ● Yes, generate output
│
└  Done. Paste the plan into Claude Code.
```

The output file (written to `docs/risral/` and copied to your clipboard) contains the concerns, plain-English overview, **and** a detailed technical plan for Claude Code to execute.

## Install

```bash
# Requires Bun (https://bun.sh) and Claude Code CLI
bun add -g risral
```

## Prerequisites

1. **[Bun](https://bun.sh)** runtime — `curl -fsSL https://bun.sh/install | bash`
2. **[Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)** installed and authenticated — this is what RISRAL uses under the hood

Verify both are working:

```bash
bun --version    # should print a version number
claude --version # should print Claude Code version
```

## Usage

```bash
# From your current project directory
risral
```

That's it. You'll be guided through:

1. **Describe your situation** — what you want to change (not the solution)
2. **Answer follow-ups** — AI asks 2 targeted questions to surface unstated intent
3. **Review the backbrief** — AI restates your intent, surfaces assumptions, asks questions
4. **Respond** — answer questions, add context, correct assumptions
5. **Review the plan** — cross-check concerns + high-level step overview
6. **Accept or revise** — iterate until you're happy, then generate output

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
