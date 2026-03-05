#!/usr/bin/env bash
# RISRAL headless mode examples
# These demonstrate how to run RISRAL programmatically via claude -p

set -euo pipefail

# ---------------------------------------------------------------------------
# 1. Basic: Backbrief a task non-interactively
#    Useful for CI gates or pre-commit review of what's about to be built.
# ---------------------------------------------------------------------------
basic_backbrief() {
  claude -p "Use the risral agent to backbrief and cross-check this task: $1" \
    --allowedTools "Read,Grep,Glob,Bash(git *),Bash(ls *),Bash(cat *)" \
    --output-format json \
    | jq -r '.result'
}

# ---------------------------------------------------------------------------
# 2. Structured output: Get concerns and plan as JSON
#    Useful for automated quality gates that parse the output.
# ---------------------------------------------------------------------------
structured_plan() {
  claude -p "Use the risral agent to analyze this task and produce a plan: $1" \
    --allowedTools "Read,Grep,Glob,Bash(git *),Bash(ls *)" \
    --output-format json \
    --json-schema '{
      "type": "object",
      "properties": {
        "concerns": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "concern": {"type": "string"},
              "severity": {"type": "string", "enum": ["low", "medium", "high"]},
              "mitigation": {"type": "string"}
            },
            "required": ["concern", "severity"]
          }
        },
        "plan_steps": {
          "type": "array",
          "items": {"type": "string"}
        },
        "assumptions": {
          "type": "array",
          "items": {"type": "string"}
        }
      },
      "required": ["concerns", "plan_steps", "assumptions"]
    }'
}

# ---------------------------------------------------------------------------
# 3. PR review: Cross-check a pull request before merge
#    Pipe the diff into RISRAL for adversarial review.
# ---------------------------------------------------------------------------
pr_review() {
  local pr_number="${1:?Usage: pr_review <pr-number>}"
  gh pr diff "$pr_number" | claude -p \
    "Use the risral-review agent to review this diff. Check whether the changes
     match the stated intent in the PR description. Flag concerns." \
    --allowedTools "Read,Grep,Glob,Bash(git *)" \
    --output-format json \
    | jq -r '.result'
}

# ---------------------------------------------------------------------------
# 4. Session continuity: Plan, then follow up
#    Capture session ID to continue the conversation.
# ---------------------------------------------------------------------------
plan_with_followup() {
  local task="$1"

  # Initial planning session
  local session_id
  session_id=$(claude -p "Use the risral agent to plan: $task" \
    --allowedTools "Read,Grep,Glob,Bash(git *),Bash(ls *)" \
    --output-format json \
    | jq -r '.session_id')

  echo "Session: $session_id"
  echo "---"

  # Follow up in the same session
  claude -p "Now consider: what if we need to support horizontal scaling?" \
    --resume "$session_id" \
    --allowedTools "Read,Grep,Glob,Bash(git *),Bash(ls *)" \
    --output-format json \
    | jq -r '.result'
}

# ---------------------------------------------------------------------------
# 5. Inline agent definition: No .claude/agents/ needed
#    Define the risral agent on the fly via --agents flag.
# ---------------------------------------------------------------------------
inline_risral() {
  claude -p "Use the risral agent to plan: $1" \
    --agents '{
      "risral": {
        "description": "Backbrief and cross-check intent before implementation. Use proactively.",
        "prompt": "You are RISRAL. Before planning any work:\n1. Ask 2 questions to surface unstated intent\n2. Backbrief: restate intent, surface assumptions, identify gaps\n3. Cross-check: list concerns, then produce a plan\n\nYour economics are inverted: exploring is free, deferral is expensive, thoroughness is free. Never commit to the first approach. Push back on unclear intent.",
        "tools": ["Read", "Grep", "Glob", "Bash"],
        "model": "sonnet"
      }
    }' \
    --allowedTools "Read,Grep,Glob,Bash(git *),Bash(ls *)"
}

# ---------------------------------------------------------------------------
# Usage: source this file and call functions, or run directly
# ---------------------------------------------------------------------------
if [[ "${1:-}" == "basic" ]]; then
  basic_backbrief "${2:?Provide a task description}"
elif [[ "${1:-}" == "structured" ]]; then
  structured_plan "${2:?Provide a task description}"
elif [[ "${1:-}" == "pr" ]]; then
  pr_review "${2:?Provide a PR number}"
elif [[ "${1:-}" == "followup" ]]; then
  plan_with_followup "${2:?Provide a task description}"
elif [[ "${1:-}" == "inline" ]]; then
  inline_risral "${2:?Provide a task description}"
else
  echo "RISRAL Headless Examples"
  echo ""
  echo "Usage:"
  echo "  $0 basic \"Add rate limiting to the API\""
  echo "  $0 structured \"Migrate auth to OAuth2\""
  echo "  $0 pr 42"
  echo "  $0 followup \"Redesign the caching layer\""
  echo "  $0 inline \"Add user notifications\""
fi
