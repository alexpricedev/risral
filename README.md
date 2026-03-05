# RISRAL

**Backbrief and cross-check your intent before building with AI.**

RISRAL is a set of Claude Code subagents that force demonstrated understanding before action. Instead of jumping straight to implementation, RISRAL backbriefs your intent (restates it, surfaces assumptions, asks questions) and cross-checks the plan for gaps — all inside your Claude Code session, with full codebase access.

## What a Session Looks Like

```
> Use risral to plan adding rate limiting to our API

[risral subagent activates]

I'll explore the codebase first to understand the current architecture...

[reads routes, middleware, package.json, deployment config]

Two questions before I backbrief:

1. What breaks first when a bot flood hits — user experience, database, or billing?
2. Who needs to be unaffected by rate limits — just bots, or are power users at risk?

> Billing — we pay per-request to a downstream provider.
> Power users are fine, ~10 req/min. Bots do 1000+.

BACKBRIEF

You need request-rate throttling to protect downstream costs. The target is
bot traffic (1000+ rpm), not legitimate power users (~10 rpm).

I found your Express app has no existing middleware for this. You're running
a single process in production (based on the Dockerfile), but your k8s config
suggests you'll scale to multiple replicas.

Assumption: you want this at the middleware level, not per-endpoint.
Gap: no mention of what should happen to throttled requests — 429? silent drop?

> 429 with retry-after. Good catch on the k8s replicas.

CONCERNS
- express-rate-limit operates per-process. With multiple k8s replicas,
  you need a shared store (Redis) or requests will be split across instances.

PLAN OVERVIEW
1. Add express-rate-limit middleware with 100 req/min default
2. Configure 429 responses with retry-after headers
3. Add Redis store for multi-instance deployments
4. Bypass rate limits for health check endpoints
5. Test with load simulation

[human accepts plan]
[Claude executes the plan in the same session with full context]
```

No clipboard. No copy-paste. The plan stays in context and Claude executes it directly.

## Install

Copy the `.claude/` directory into your project:

```bash
# Clone and copy the agents + skills into your project
git clone https://github.com/alexpricedev/risral.git /tmp/risral
cp -r /tmp/risral/.claude/agents /tmp/risral/.claude/skills your-project/.claude/
```

Or install globally for all projects:

```bash
cp -r /tmp/risral/.claude/agents/* ~/.claude/agents/
cp -r /tmp/risral/.claude/skills/* ~/.claude/skills/
```

### Prerequisites

- **[Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)** installed and authenticated

That's it. No Bun, no npm package, no external runtime.

## Usage

### Interactive (inside Claude Code)

```
# Plan a feature
> Use risral to plan adding OAuth2 support

# Review after implementation
> Use risral-review to check if the OAuth2 implementation matches the plan

# Load principles into any conversation
> Load the risral-principles skill
```

Claude automatically delegates to the right subagent based on the task.

### Headless (scripted / CI)

```bash
# Basic backbrief
claude -p "Use the risral agent to plan: Add rate limiting to the API" \
  --allowedTools "Read,Grep,Glob,Bash(git *),Bash(ls *)"

# Structured JSON output
claude -p "Use the risral agent to analyze: Migrate auth to OAuth2" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"concerns":{"type":"array","items":{"type":"string"}},"plan_steps":{"type":"array","items":{"type":"string"}}}}'

# PR review gate
gh pr diff 42 | claude -p "Use risral-review to cross-check this diff" \
  --allowedTools "Read,Grep,Glob,Bash(git *)"

# Inline agent (no .claude/ directory needed)
claude -p "Plan: $TASK" --agents '{
  "risral": {
    "description": "Backbrief and cross-check intent before implementation.",
    "prompt": "You are RISRAL. Before planning: 1) Ask 2 questions to surface intent 2) Backbrief: restate, surface assumptions, identify gaps 3) Cross-check: list concerns, produce plan. Exploring is free. Never commit to the first approach.",
    "tools": ["Read", "Grep", "Glob", "Bash"],
    "model": "sonnet"
  }
}'
```

See `scripts/headless-examples.sh` for more patterns.

## What's Included

| File | Purpose |
|---|---|
| `.claude/agents/risral.md` | Main planning agent — backbrief + cross-check with codebase exploration and persistent memory |
| `.claude/agents/risral-review.md` | Post-implementation review agent — verifies intent match and captures learnings |
| `.claude/skills/risral-principles.md` | Operating principles skill — loadable into any agent or conversation |
| `scripts/headless-examples.sh` | Headless mode examples for CI/CD and scripting |

## Architecture

### Subagents vs. the old CLI wrapper

Previous versions of RISRAL were a standalone CLI tool that produced a markdown file you'd paste into Claude Code. That approach had a fundamental limitation: **context loss**. The backbrief exchange, cross-check concerns, and operating principles all evaporated the moment you opened a new session.

The subagent architecture solves this:

- **No context loss** — the subagent runs inside Claude Code. Its output stays in the conversation and informs execution directly.
- **Codebase access** — the subagent reads your actual code during planning, so backbriefs reference real files, patterns, and dependencies.
- **Persistent memory** — the `memory: project` setting gives each subagent a persistent directory (`.claude/agent-memory/`) that accumulates learnings across sessions. This is synthetic reputation — the thing the old reputation system tried to build manually.
- **No external runtime** — no Bun, no npm package. Just markdown files that Claude Code reads natively.

### The RISRAL Process

1. **Situation** — human describes what they want to change (not the solution)
2. **Exploration** — subagent reads the relevant codebase
3. **Intent questions** — 2 targeted questions surface unstated assumptions
4. **Backbrief** — subagent restates intent, surfaces gaps, proposes "done" criteria
5. **Cross-check** — adversarial review: concerns + plan with technical detail
6. **Execution** — Claude acts on the plan with full context preserved
7. **Review** (optional) — risral-review verifies implementation matches intent

### Operating Principles

Baked into every RISRAL agent:

- **Exploring is free.** Never commit to the first viable approach.
- **Deferral is expensive.** No future session remembers this one.
- **Intent over instruction.** Hear the why behind the how.
- **No aim-to-please.** Optimize for the work succeeding, not the human feeling good.
- **Show uncertainty.** Never collapse uncertainty into false confidence.

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
- **Synthetic reputation** — Since AI lacks persistent memory and accumulated consequences, external mechanisms (backbrief, cross-check, persistent memory) substitute for the reputation that humans build naturally over time.

---

## License

MIT
