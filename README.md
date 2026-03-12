# RISRAL

**Backbrief and cross-check your intent before building with AI.**

RISRAL makes Claude Code stop and think before it builds. Instead of jumping straight to code, it forces a **backbrief** (restate your intent, surface assumptions, ask questions) and a **cross-check** (adversarial review for gaps) — then executes with full context.

It works by adding [custom subagents](https://code.claude.com/docs/en/sub-agents) to your Claude Code setup. Subagents are specialized AI assistants that run inside Claude Code with their own instructions and tool access. You talk to Claude Code normally, and it delegates to the RISRAL subagent when planning is needed.

## Quick Start

**1. Install the RISRAL agents into your project:**

```bash
git clone https://github.com/alexpricedev/risral.git /tmp/risral
cd your-project
mkdir -p .claude
cp -r /tmp/risral/.claude/agents /tmp/risral/.claude/skills .claude/
```

**2. Open Claude Code in your project and try it:**

```
> Use risral to plan adding rate limiting to our API
```

That's it. Claude will delegate to the RISRAL subagent, which explores your codebase, asks you questions, backbriefs your intent, and produces a cross-checked plan — all before writing a line of code.

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

The plan stays in context. No clipboard, no copy-paste, no context loss between planning and execution.

## Install

### Per-project (recommended)

Install the agents and skills into your project's `.claude/` directory. This way your team gets RISRAL when they clone the repo.

```bash
git clone https://github.com/alexpricedev/risral.git /tmp/risral
mkdir -p your-project/.claude
cp -r /tmp/risral/.claude/agents /tmp/risral/.claude/skills your-project/.claude/
```

### Global (all projects)

Install the agents and skills to your home directory so RISRAL is available in every project on your machine.

```bash
git clone https://github.com/alexpricedev/risral.git /tmp/risral
mkdir -p ~/.claude/agents ~/.claude/skills
cp /tmp/risral/.claude/agents/* ~/.claude/agents/
cp /tmp/risral/.claude/skills/* ~/.claude/skills/
```

### Prerequisites

- [Claude Code](https://code.claude.com/docs/en/getting-started) installed and authenticated

That's it. No npm packages, no runtime dependencies, no build step.

## Usage

### Interactive (inside Claude Code)

```
# Plan a feature — RISRAL will backbrief and cross-check before Claude builds
> Use risral to plan adding OAuth2 support

# Review after implementation — check if what was built matches the intent
> Use risral-review to check if the OAuth2 implementation matches the plan

# Load just the principles into any conversation (no backbrief flow)
> Load the risral-principles skill
```

Claude automatically delegates to the right subagent based on what you ask for.

### Headless (scripted / CI)

Run RISRAL without a human in the loop using Claude Code's `-p` flag:

```bash
# Basic: get a backbrief and plan as text
claude -p "Use the risral agent to plan: Add rate limiting to the API" \
  --allowedTools "Read,Grep,Glob,Bash(git *),Bash(ls *)"

# Structured: get concerns and plan as JSON for automated quality gates
claude -p "Use the risral agent to analyze: Migrate auth to OAuth2" \
  --output-format json \
  --json-schema '{"type":"object","properties":{"concerns":{"type":"array","items":{"type":"string"}},"plan_steps":{"type":"array","items":{"type":"string"}}}}'

# PR review: pipe a diff into RISRAL for adversarial review
gh pr diff 42 | claude -p "Use risral-review to cross-check this diff" \
  --allowedTools "Read,Grep,Glob,Bash(git *)"
```

See [`scripts/headless-examples.sh`](scripts/headless-examples.sh) for more patterns including session continuity and inline agent definitions.

## What's Included

| File | Purpose |
|---|---|
| `.claude/agents/risral.md` | Main planning agent — backbrief + cross-check with codebase exploration and persistent memory |
| `.claude/agents/risral-review.md` | Post-implementation review agent — verifies the build matches the intent |
| `.claude/skills/risral-principles.md` | Operating principles — loadable into any agent or conversation |
| `scripts/headless-examples.sh` | Headless mode examples for CI/CD and scripting |

## How It Works

### The RISRAL Process

1. **Situation** — you describe what you want to change (not the solution)
2. **Exploration** — the subagent reads your actual codebase to understand current state
3. **Intent questions** — 2 targeted questions surface unstated assumptions
4. **Backbrief** — the subagent restates your intent in its own words, surfaces gaps, proposes what "done" looks like
5. **Cross-check** — adversarial review: concerns + detailed plan
6. **Execution** — Claude acts on the plan with full context preserved
7. **Review** (optional) — `risral-review` checks if what was built matches the original intent

### Persistent Memory

Both subagents use `memory: project`, which means they build up knowledge about your codebase across sessions. The first time RISRAL plans something, it starts fresh. The tenth time, it remembers past decisions, patterns it discovered, and what worked. This accumulates in `.claude/agent-memory/` and is committed to the repo so the team shares context.

### Operating Principles

Every RISRAL agent operates under these principles:

- **Exploring is free.** Never commit to the first viable approach.
- **Deferral is expensive.** No future session remembers this one. Do it now.
- **Intent over instruction.** Hear the *why* behind the *how*.
- **No aim-to-please.** Optimize for the work succeeding, not the human feeling good.
- **Show uncertainty.** Never collapse uncertainty into false confidence.

---

## Why RISRAL Exists

AI models are O-shaped — vast knowledge across every domain, no experiential filter. Humans are T-shaped — deep in one or two domains, shaped by decades of consequences. When they collaborate, both sides default to patterns that don't work:

- **Humans give instructions when they should define intent.** The more precisely you specify *how*, the more faithfully the AI executes — even when the *how* is wrong.
- **AI inherits human economics.** It commits early (as if exploring were expensive), defers fixes (as if deferral saved effort), and projects false confidence (as if reputation were at stake). None of these constraints apply to AI.
- **AI has no reputation.** Every session starts at zero. No accumulated consequence for being wrong, no scar tissue from past mistakes.

RISRAL corrects for this by forcing a backbrief (demonstrate understanding before acting), a cross-check (adversarial review before committing), and persistent memory (synthetic reputation across sessions).

### Theoretical Foundation

- **Auftragstaktik** (mission-type tactics) — von Moltke's insight that alignment and autonomy reinforce each other. Define intent, grant autonomy on action. Via Stephen Bungay's *The Art of Action* and its three gaps: knowledge, alignment, and effects.
- **The Emdash Problem** — AI benchmark performance outpaces economic impact because models inherit misaligned economics from training data created by humans operating under different constraints.
- **Behavioural economics of intelligence** — T-shaped humans compress, defer, and commit because those decisions are rational given their cost structure. O-shaped AI does the same despite having inverted economics.
- **Synthetic reputation** — since AI lacks persistent memory and accumulated consequences, external mechanisms (backbrief, cross-check, persistent memory) substitute for the reputation humans build naturally.

---

## License

MIT
