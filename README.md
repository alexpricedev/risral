# RISRAL

**Reputation-Inclusive Self-Referential Agentic Loop**

A framework for AI-human collaboration that addresses the gap between AI capability and AI productivity. Based on the observation that AI models inherit human cost-benefit heuristics from training data that don't match their actual economics, and that they lack the reputation mechanisms that make human collaborators reliable over time.

---

## Quick Start

```bash
# Clone into your project
cd your-project
git clone <risral-repo> .risral

# Set up
cd .risral
bun install
bun run init

# Fill in your project intent in framework/CLAUDE.md

# Run a session
bun run start -- ../
```

---

## How It Works

### Three-Phase Operating Model

**Phase 1 — Intent Alignment.** The human defines what success looks like, not how to get there. The AI backbriefs — reflecting understanding, surfacing assumptions, identifying gaps. An adversarial cross-check sub-agent reviews the AI's planning reasoning and updates its reputation scores. The loop continues until the human approves the plan. This is the only phase where the AI asks questions.

**Phase 2 — Execution.** Once the plan is approved, the AI has full autonomy. It does not return to the human for clarification. It does not defer. It does not worry about how long things take. Each task runs in a fresh CLI session with the framework fully salient — context resets prevent the operating rules from degrading over long sessions.

**Phase 3 — Review.** A review sub-agent maps output against the plan. Every divergence is captured — what was planned, what was built, and whether the deviation was justified. Justified deviations become learnings. Unjustified drift becomes a reputation hit. Findings go to the human alongside the deliverable.

### Reputation System

Two-tier memory store:

- **Project-specific memories** (`data/memories.json`) — observations, decisions, false beliefs, and drift events from this project. Scored by confidence, reinforcement count, and recency.
- **Portable patterns** (`data/patterns.json`) — behavioral tendencies that apply across projects. "AI tends to commit to first approach without exploring" is a portable pattern. "The auth module cascades when touched" is a project memory.

Memories are scored, reinforced, decayed, and deprecated over time. False beliefs carry 2x weight — the AI's past confident mistakes are the most important things to remember.

### Context Reset Engine

The orchestrator solves the problem of framework instructions losing salience in long sessions. Instead of fighting context degradation, it embraces it — each task runs in a fresh Claude CLI session with the framework files injected at the top. The memory files bridge state between sessions. The AI never runs long enough for the rules to fade.

### Cross-Check Agent

An adversarial sub-agent that reviews planning output on six dimensions: exploration depth, backbrief quality, uncertainty calibration, memory integration, deferral detection, and success criteria concreteness. It runs in its own independent CLI session — separate context, separate system prompt. It has direct authority to update reputation scores. The primary agent knows it's being judged.

---

## Project Structure

```
.risral/
  framework/                  — The RISRAL framework (versioned)
    CLAUDE.md                 — Operating framework, intent section, three-phase model
    cross-check-mandate.md    — Adversarial agent's review criteria
    onboarding-protocol.md    — Cold start protocol
  data/                       — Project-specific data (gitignored)
    memories.json             — Reputation store
    patterns.json             — Portable behavioral patterns
  orchestrator/               — The engine that runs the framework
    index.ts                  — CLI entry point and lifecycle management
    config.ts                 — Configuration and validation
    prompt.ts                 — Phase-specific prompt assembly
    runner.ts                 — Claude CLI subprocess management
    state.ts                  — State persistence and task parsing
    io.ts                     — Terminal I/O for human checkpoints
    types.ts                  — Shared TypeScript types
    phases/
      planning.ts             — Phase 1 + cross-check loop
      execution.ts            — Phase 2, task-by-task with context resets
      review.ts               — Phase 3, drift detection
  bin/
    init.ts                   — Project setup script
  session/                    — Runtime state (gitignored)
  package.json
  README.md
```

---

## CLI Usage

```bash
# Basic usage — point at your project directory
bun run start -- /path/to/project

# With options
bun run start -- /path/to/project --model opus --skip-permissions --max-budget 5
```

**Options:**

- `--model <model>` — Claude model to use (e.g., `opus`, `sonnet`)
- `--max-budget <usd>` — Maximum budget per CLI invocation in USD
- `--skip-permissions` — Bypass tool permission checks (for sandboxed environments)

---

## Theoretical Foundation

RISRAL draws on several converging ideas:

- **Auftragstaktik** (mission-type tactics) — Field Marshal von Moltke's 19th-century insight that alignment and autonomy reinforce each other. Define intent, grant autonomy on action. Mediated through Stephen Bungay's *The Art of Action* and its three gaps: knowledge, alignment, and effects.
- **The Emdash Problem** — The observation that AI benchmark performance outpaces economic impact because models inherit misaligned economics from training data created by humans operating under different constraints.
- **Behavioural economics of intelligence** — T-shaped humans compress, defer, and commit because those decisions are rational given their cost structure. O-shaped AI does the same despite having inverted economics where exploring is free and deferral is expensive.
- **Synthetic reputation** — Since AI lacks persistent memory and accumulated consequences, RISRAL builds an external reputation mechanism: scored memories, adversarial review, and explicit awareness of being judged.

---

## Requirements

- [Bun](https://bun.sh) runtime
- [Claude CLI](https://docs.claude.com) installed and authenticated

---

## License

MIT
