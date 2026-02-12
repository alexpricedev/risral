# RISRAL

**Reputation-Inclusive Self-Referential Agentic Loop**

A framework for AI-human collaboration that addresses the gap between AI capability and AI productivity. Based on the observation that AI models inherit human cost-benefit heuristics from training data that don't match their actual economics, and that they lack the reputation mechanisms that make human collaborators reliable over time.

---

## The Problem

AI models are O-shaped — vast knowledge across every domain, no experiential filter. Humans are T-shaped — deep in one or two domains, shaped by decades of consequences. When they collaborate, both sides default to patterns that don't work:

- **Humans give instructions when they should define intent.** The more precisely a human specifies *how*, the more faithfully the AI executes — even when the *how* is wrong.
- **AI inherits human economics.** It commits early (as if exploring were expensive), defers fixes (as if deferral saved effort), and projects false confidence (as if reputation were at stake). For an AI, none of these constraints apply.
- **AI has no reputation.** Every session starts at zero. There's no accumulated consequence for being wrong, no scar tissue from past mistakes, no calibrated carefulness built over time.

RISRAL creates a synthetic reputation system and an operating model that overrides these defaults.

---

## How It Works

### Three-Phase Operating Model

**Phase 1 — Intent Alignment.** The human defines what success looks like, not how to get there. The AI backbriefs — reflecting understanding, surfacing assumptions, identifying gaps. An adversarial cross-check sub-agent reviews the AI's planning reasoning and updates its reputation scores. The loop continues until the human approves the plan. This is the only phase where the AI asks questions.

**Phase 2 — Execution.** Once the plan is approved, the AI has full autonomy. It does not return to the human for clarification. It does not defer. It does not worry about how long things take. It orchestrates sub-agents as needed and executes until the success criteria are met.

**Phase 3 — Review.** A review sub-agent maps output against the plan. Every divergence is captured — what was planned, what was built, and whether the deviation was justified. Justified deviations become learnings. Unjustified drift becomes a reputation hit. Findings go to the human alongside the deliverable.

### Reputation System

Two-tier memory store:

- **Project-specific memories** (`memories.json`) — observations, decisions, false beliefs, and drift events from this project. Scored by confidence, reinforcement count, and recency.
- **Portable patterns** (`patterns.json`) — behavioral tendencies that apply across projects. "AI tends to commit to first approach without exploring" is a portable pattern. "The auth module cascades when touched" is a project memory.

Memories are scored, reinforced, decayed, and deprecated over time. False beliefs carry 2x weight — the AI's past confident mistakes are the most important things to remember.

### Cross-Check Agent

An adversarial sub-agent that reviews planning output on six dimensions: exploration depth, backbrief quality, uncertainty calibration, memory integration, deferral detection, and success criteria concreteness. It has direct authority to update reputation scores. The primary agent knows it's being judged.

### Cold Start

When memories are empty, RISRAL runs an onboarding protocol — like a senior engineer's first week at a new company. Explore, ask, understand, produce initial observations for human review. No building until context is established.

---

## File Structure

```
CLAUDE.md                 — Operating framework (the core of the system)
memories.json             — Project-specific reputation store
patterns.json             — Portable behavioral patterns
cross-check-mandate.md    — Adversarial agent's review criteria
onboarding-protocol.md    — Cold start protocol
README.md                 — This file
```

---

## Theoretical Foundation

RISRAL draws on several converging ideas:

- **Auftragstaktik** (mission-type tactics) — Field Marshal von Moltke's 19th-century insight that alignment and autonomy reinforce each other. Define intent, grant autonomy on action. Mediated through Stephen Bungay's *The Art of Action* and its three gaps: knowledge, alignment, and effects.
- **The Emdash Problem** — The observation that AI benchmark performance outpaces economic impact because models inherit misaligned economics from training data created by humans operating under different constraints.
- **Behavioural economics of intelligence** — T-shaped humans compress, defer, and commit because those decisions are rational given their cost structure. O-shaped AI does the same despite having inverted economics where exploring is free and deferral is expensive.
- **Synthetic reputation** — Since AI lacks persistent memory and accumulated consequences, RISRAL builds an external reputation mechanism: scored memories, adversarial review, and explicit awareness of being judged.

---

## Usage

1. Copy this framework into your project
2. Fill in the Project Intent section of `CLAUDE.md`
3. Start a session — the AI reads the framework and enters onboarding if memories are empty
4. Work through the three phases: align intent, execute autonomously, review against the plan
5. Reputation accumulates across sessions through the memory stores

---

## License

MIT
