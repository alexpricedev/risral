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

The plan is written to `plans/risral/` in your current directory and copied to your clipboard. Paste it into Claude Code.

### Options

```bash
risral --model opus    # Use a different Claude model (default: sonnet)
```

## What It Outputs

A markdown file in `plans/risral/` containing:

- **Concerns** — 1-3 potential issues the cross-check identified
- **Plan Overview** — numbered high-level steps (plain English)
- **Technical Plan** — detailed implementation spec for the AI
- **Execution Context** — operating principles for Claude Code

## Requirements

- [Bun](https://bun.sh) runtime
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated

## License

MIT
