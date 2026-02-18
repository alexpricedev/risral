# RISRAL Simplification Design

## Problem

RISRAL has too much friction. The plan → paste → execute → learn workflow is slow and nobody would use it as-is. The backbrief and cross-check concepts are valuable but buried under orchestration machinery.

## Solution

Strip RISRAL down to a single interactive CLI command that does two things well: **backbrief** and **cross-check**. No reputation system, no init ceremony, no subcommands. Default to Sonnet for speed.

## Target Audience

Anyone using AI coding tools. Must be dead simple to install and use.

## User Flow

```
$ risral

┌ RISRAL
│
◆ What do you want to build?
│ > [user types intent]
│
◇ Backbriefing...
│
│ BACKBRIEF
│ [AI restates intent, surfaces assumptions, asks questions]
│
◆ Your response:
│ > [user answers questions / adds context]
│
◇ Cross-checking...
│
│ CROSS-CHECK
│ ⚠ [max 3 bullet points: suggestion + reasoning]
│
│ PLAN OVERVIEW
│ 1. [step title — plain English, no technical details]
│ 2. ...
│
◆ Accept plan?
│ ● Yes, generate output
│ ○ Revise — give feedback
│
◇ Written to plans/risral/2026-02-18-<slug>.md
│
└ Done. Paste the plan into Claude Code.
```

### UX Principles

- Cross-check output: **max 3 concerns** with reasoning. Light, not overwhelming.
- Plan overview: **numbered steps with plain-English titles only**. No technical details shown to user.
- Full technical plan: written to the output file for the AI to consume. User doesn't need to read it.
- Revision loop: user can give feedback and iterate before accepting.

## Architecture

### File Structure

```
risral/
├── package.json          # bun, @clack/prompts, picocolors
├── bin/risral.ts          # entry point, interactive flow
├── lib/
│   ├── ai.ts             # call Claude CLI (Sonnet default)
│   ├── prompts.ts         # backbrief + cross-check prompt templates
│   └── output.ts          # format + write the plan file
└── framework/
    └── CLAUDE.md          # stripped-down operating framework
```

**4 source files. Target ~500 LOC total.**

### Components

**`bin/risral.ts`** — Entry point. Uses @clack/prompts for interactive flow. Collects intent, shows backbrief, collects response, runs cross-check, shows overview, writes file. Shebang `#!/usr/bin/env bun` for global execution.

**`lib/ai.ts`** — Thin wrapper around `claude -p` using stdin-piped prompts (same approach as current runner.ts). Defaults to Sonnet. `--model` flag to override.

**`lib/prompts.ts`** — Two prompt templates:
- Backbrief: "Restate intent, surface assumptions, ask clarifying questions. Be concise."
- Cross-check: "Review this plan. Max 3 concerns with reasoning. Numbered step overview (titles only). Full technical plan in separate section."

**`lib/output.ts`** — Takes AI response, writes to `plans/risral/YYYY-MM-DD-<slug>.md`. File contains both human-readable overview and full technical plan.

**`framework/CLAUDE.md`** — Stripped-down operating framework. Core principles only: explore freely, don't defer, verify thoroughly.

### What Gets Deleted

- `orchestrator/` — entire directory (state machine, phases, memory, config, UI wrapper)
- `data/` — memories.json, patterns.json (no reputation system)
- `orchestrator/commands/` — init, learn, status (no subcommands)
- `framework/cross-check-mandate.md` — replaced by simpler prompt
- `framework/onboarding-protocol.md` — no onboarding needed

### Dependencies

Same as today: `@clack/prompts`, `picocolors`, `@types/bun`. Nothing new added.

## Distribution

### Global install via npm/bun

```json
{
  "name": "risral",
  "bin": {
    "risral": "./bin/risral.ts"
  }
}
```

- **Development**: `bun link` makes `risral` available globally
- **Users**: `npm i -g risral` or `bun add -g risral`
- **Prerequisite**: Bun runtime (documented in README)

## Output File Format

The file written to `plans/risral/` contains:

1. **Metadata** — date, intent summary
2. **Plan overview** — the numbered steps shown to user
3. **Cross-check findings** — the concerns raised
4. **Full technical plan** — detailed implementation spec for the AI
5. **Execution framing** — instructions for Claude Code (explore freely, don't defer, verify)

## Non-Goals

- No reputation/memory system
- No session management or resume
- No init command
- No learn command
- No status command
- No adversarial agent as separate invocation (cross-check is inline)
