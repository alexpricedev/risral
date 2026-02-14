# RISRAL

**Reputation-Inclusive Self-Referential Agentic Loop**

*Teaching AI to work like it actually works, not like humans do.*

AI models inherit human cost-benefit heuristics from their training data — compress, defer, commit to the first viable approach — but those heuristics are wrong for AI. Exploring is free. Deferral is expensive. Thoroughness costs nothing. RISRAL is a collaboration framework that corrects for this mismatch using intent alignment, adversarial review, and a synthetic reputation system that gives AI accumulated consequences across sessions.

The framework operates in three phases:

- **Plan** — The AI backbriefs your intent, explores approaches, and produces a concrete plan. An adversarial cross-check agent scores the reasoning.
- **Execute** — You take the plan into Claude Code CLI and drive execution directly, watching and course-correcting in real time.
- **Learn** — You report what happened. Drift, false beliefs, and behavioral patterns feed back into the reputation store for the next session.

---

## Quick Start

```bash
# Clone into your project
cd your-project
git clone <risral-repo> .risral

# Install dependencies
cd .risral && bun install

# Set up — guided questions will define your project intent
bun run init

# Run your first planning session
bun run plan
```

The planning session produces a self-contained output document. Paste it into Claude Code CLI and execute. When you're done, run `bun run learn` to feed outcomes back into the reputation system.

---

## How It Works

### Phase 1a — Backbrief

The AI reads your project intent, session intent, and the full reputation store (memories + behavioral patterns from previous sessions). It produces a backbrief that reflects understanding, surfaces assumptions and gaps, and asks every question it needs answered. This is the only interactive checkpoint — the AI must ask everything now, because it won't get another chance.

### Phase 1b — Planning

The AI explores at least two approaches internally, picks the best one, and presents a concrete plan with explicit success criteria. It does not present a menu of options — that's deferral, not engineering. An adversarial cross-check sub-agent reviews the reasoning and updates reputation scores. The human reviews both the plan and the cross-check findings. The loop continues until the human approves.

### Phase 2 — Execution

When the human approves the plan, the orchestrator produces a self-contained plan output document. The human takes this into Claude Code CLI and drives execution directly.

This is deliberate. The human watches execution in real time, course-corrects when the AI drifts, and verifies each task is genuinely complete before moving on. This replaces the previous model of unsupervised autonomous execution, which produced known issues with uncommitted work, execution drift, and premature completion claims.

### Phase 3 — Learning

After execution, the human runs `bun run learn` and reports what happened — how execution went, what drifted from the plan, and whether any false beliefs were discovered. A Claude invocation processes this feedback into the reputation store:

- **Drift events** are recorded for reported divergences (tagged as justified or unjustified based on the human's assessment)
- **False beliefs** are challenged or deprecated when disproven during execution
- **Behavioral patterns** are created or reinforced based on observed tendencies

The signal is human-reported rather than AI-measured, but it is more accurate — the human actually witnessed what happened.

---

## Reputation System

Two-tier memory store that gives AI accumulated consequences across sessions:

- **Project-specific memories** (`data/memories.json`) — Observations, decisions, false beliefs, and drift events from this project. Scored by confidence, reinforcement count, and recency.
- **Portable behavioral patterns** (`data/patterns.json`) — Tendencies that apply across projects. "AI tends to commit to first approach without exploring" is a portable pattern. "The auth module cascades when touched" is a project memory.

Memories are scored, reinforced, decayed, and deprecated over time. **False beliefs carry 2x weight** — the AI's past confident mistakes are the most important things to remember.

Reputation updates come from two sources:

1. **Cross-check agent** (during planning) — scores the AI's reasoning behavior in Phase 1. Updates take effect immediately.
2. **Human-reported outcomes** (via `bun run learn`) — the human reports what happened during execution. Drift events, false beliefs, and behavioral patterns are recorded.

View the current reputation state with `bun run status`.

---

## Cross-Check Agent

An adversarial sub-agent that reviews planning output on six dimensions:

1. **Exploration depth** — Did the AI genuinely explore alternatives, or commit to the first viable option?
2. **Backbrief quality** — Did the backbrief contain new insight, or just mirror the human's words?
3. **Uncertainty calibration** — Did the AI surface real uncertainty, or project false confidence?
4. **Memory integration** — Did the AI account for relevant memories from the reputation store?
5. **Deferral detection** — Did the AI defer anything that should be resolved now?
6. **Success criteria concreteness** — Is "done" defined concretely enough to be measurable?

The cross-check agent runs during Phase 1b planning in its own independent CLI session — separate context, separate system prompt. It has direct authority to update reputation scores. The primary agent knows it's being judged.

---

## Project Structure

```
.risral/                        (cloned into your project)
  framework/                    — Operating framework (versioned)
    CLAUDE.md                   — Three-phase model and AI economics
    cross-check-mandate.md      — Adversarial review criteria
    onboarding-protocol.md      — Cold start protocol
  data/                         — Project-specific data (gitignored)
    memories.json               — Reputation store
    patterns.json               — Portable behavioral patterns
  orchestrator/                 — The engine
    index.ts                    — Subcommand router
    config.ts                   — Configuration and path resolution
    prompt.ts                   — Phase-specific prompt assembly
    runner.ts                   — Claude CLI subprocess management
    state.ts                    — State persistence and task parsing
    output.ts                   — Plan output document generation
    memory.ts                   — Memory/pattern loading
    ui.ts                       — Terminal UI (wraps @clack/prompts)
    types.ts                    — Shared TypeScript types
    commands/
      plan.ts                   — Planning session orchestration
      learn.ts                  — Outcome feedback → reputation updates
      status.ts                 — Reputation state display
      init.ts                   — Project setup
    phases/
      planning.ts               — Phase 1a backbrief + 1b planning + cross-check
  bin/
    init.ts                     — Backward-compat wrapper
  session/                      — Runtime state (gitignored)
  package.json
  README.md
```

---

## CLI Usage

```bash
bun run plan          # Run a planning session (default)
bun run learn         # Feed execution outcomes into reputation
bun run status        # View memories and behavioral patterns
bun run init          # Set up project intent (one-time)
```

**The lifecycle:**

1. `bun run init` — Set up project intent (one-time)
2. `bun run plan` — Plan a session (intent → backbrief → plan → cross-check → output)
3. Paste the plan output into Claude Code CLI and execute
4. `bun run learn` — Feed outcomes back into the reputation system
5. `bun run status` — View your reputation state

**Options:**

- `--model <model>` — Claude model to use (e.g., `opus`, `sonnet`)
- `--max-budget <usd>` — Maximum budget per CLI invocation in USD
- `--no-skip-permissions` — Require tool permission prompts

---

## Requirements

- [Bun](https://bun.sh) runtime
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated — RISRAL's execution model depends on Claude Code specifically, not just any Claude interface

---

## Theoretical Foundation

RISRAL draws on several converging ideas:

- **Auftragstaktik** (mission-type tactics) — Field Marshal von Moltke's 19th-century insight that alignment and autonomy reinforce each other. Define intent, grant autonomy on action. Mediated through Stephen Bungay's *The Art of Action* and its three gaps: knowledge, alignment, and effects.
- **The Emdash Problem** — The observation that AI benchmark performance outpaces economic impact because models inherit misaligned economics from training data created by humans operating under different constraints.
- **Behavioural economics of intelligence** — T-shaped humans compress, defer, and commit because those decisions are rational given their cost structure. O-shaped AI does the same despite having inverted economics where exploring is free and deferral is expensive.
- **Synthetic reputation** — Since AI lacks persistent memory and accumulated consequences, RISRAL builds an external reputation mechanism: scored memories, adversarial review during planning, and human-reported outcomes that feed back into the reputation store across sessions.

---

## License

MIT
