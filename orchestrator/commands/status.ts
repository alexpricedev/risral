// RISRAL — Status Command
//
// Displays the current state of the reputation system:
// - Memory count by type
// - Top 5 memories by priority score
// - Active patterns with confidence and countermeasures
// - Session state (if one exists)
//
// Read-only. No Claude invocations.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RisralConfig } from "../types.ts";
import * as ui from "../ui.ts";

// --- Raw types (mirrors memory.ts, but we need structured access here) ---

interface MemoryConfidence {
  score: number;
  reasoning: string;
}

interface Memory {
  id: string;
  type: "observation" | "pattern" | "decision" | "false_belief" | "drift_event";
  content: string;
  context: string;
  source: string;
  confidence: MemoryConfidence;
  reinforcement_count: number;
  status: "active" | "deprecated" | "challenged";
}

interface MemoriesFile {
  memories: Memory[];
  _schema?: unknown;
}

interface Pattern {
  id: string;
  category: string;
  content: string;
  countermeasure: string;
  confidence: MemoryConfidence;
  reinforcement_count: number;
  status: "active" | "deprecated" | "challenged";
}

interface PatternsFile {
  patterns: Pattern[];
  _schema?: unknown;
}

// --- Helpers ---

const TYPE_LABELS: Record<Memory["type"], string> = {
  false_belief: "False Beliefs",
  drift_event: "Drift Events",
  decision: "Decisions",
  pattern: "Patterns",
  observation: "Observations",
};

function priorityScore(mem: Memory): number {
  return mem.confidence.score * (mem.reinforcement_count + 1);
}

function pct(score: number): string {
  return `${(score * 100).toFixed(0)}%`;
}

// --- Sections ---

function buildMemorySummary(memories: Memory[]): string {
  const active = memories.filter((m) => m.status !== "deprecated");
  const deprecated = memories.length - active.length;

  // Count by type (active only)
  const counts: Record<string, number> = {};
  for (const mem of active) {
    const label = TYPE_LABELS[mem.type] ?? mem.type;
    counts[label] = (counts[label] ?? 0) + 1;
  }

  const lines: string[] = [];
  lines.push(`**${active.length} active** (${deprecated} deprecated)\n`);

  // Show type counts
  for (const [label, count] of Object.entries(counts)) {
    lines.push(`- ${label}: ${count}`);
  }

  // Top 5 by priority score
  const sorted = [...active].sort(
    (a, b) => priorityScore(b) - priorityScore(a)
  );
  const top = sorted.slice(0, 5);

  if (top.length > 0) {
    lines.push("");
    lines.push("**Top 5 by priority:**\n");
    for (const mem of top) {
      const statusTag = mem.status === "challenged" ? " [challenged]" : "";
      const score = priorityScore(mem).toFixed(2);
      lines.push(
        `- **${mem.id}** (${TYPE_LABELS[mem.type]}, ${pct(mem.confidence.score)}${statusTag}, priority ${score})`
      );
      // Truncate content to first sentence or 120 chars
      const summary = mem.content.split(". ")[0];
      const truncated =
        summary.length > 120 ? summary.slice(0, 117) + "..." : summary;
      lines.push(`  ${truncated}`);
    }
  }

  return lines.join("\n");
}

function buildPatternSummary(patterns: Pattern[]): string {
  const active = patterns.filter((p) => p.status !== "deprecated");
  const deprecated = patterns.length - active.length;

  if (active.length === 0) {
    return deprecated > 0
      ? `All ${deprecated} patterns are deprecated.`
      : "No behavioral patterns on file.";
  }

  const lines: string[] = [];
  lines.push(`**${active.length} active** (${deprecated} deprecated)\n`);

  // Sort by confidence descending
  const sorted = [...active].sort(
    (a, b) => b.confidence.score - a.confidence.score
  );

  for (const pat of sorted) {
    const statusTag = pat.status === "challenged" ? " [challenged]" : "";
    lines.push(
      `### ${pat.id}: ${pat.category.toUpperCase()}${statusTag}`
    );
    lines.push(`**Confidence:** ${pct(pat.confidence.score)}`);

    // Truncate content to first sentence
    const summary = pat.content.split(". ")[0];
    const truncated =
      summary.length > 120 ? summary.slice(0, 117) + "..." : summary;
    lines.push(truncated);

    lines.push(`**Countermeasure:** ${pat.countermeasure.split(". ")[0]}.`);
    lines.push("");
  }

  return lines.join("\n");
}

function buildSessionSummary(config: RisralConfig): string | null {
  const statePath = resolve(config.sessionDir, "state.json");
  if (!existsSync(statePath)) return null;

  let state: { phase?: string; startedAt?: string; planApproved?: boolean };
  try {
    state = JSON.parse(readFileSync(statePath, "utf-8"));
  } catch {
    return "Failed to read session state.";
  }

  const lines: string[] = [];
  lines.push(`**Phase:** ${state.phase ?? "unknown"}`);
  if (state.startedAt) {
    lines.push(`**Started:** ${state.startedAt}`);
  }
  if (state.planApproved) {
    lines.push("**Plan:** Approved");
  }

  // Check for plan output
  const planOutputPath = resolve(config.sessionDir, "plan-output.md");
  if (existsSync(planOutputPath)) {
    lines.push("**Plan output:** Generated");
  }

  // Check for intent
  const intentPath = resolve(config.sessionDir, "intent.md");
  if (existsSync(intentPath)) {
    const intent = readFileSync(intentPath, "utf-8").trim();
    const truncated =
      intent.length > 120 ? intent.slice(0, 117) + "..." : intent;
    lines.push(`**Intent:** ${truncated}`);
  }

  return lines.join("\n");
}

// --- Main ---

export async function runStatusCommand(config: RisralConfig): Promise<void> {
  ui.intro();
  ui.phaseIntro("Status", "Reputation system overview");

  // Load memories
  const memoriesPath = resolve(config.dataDir, "memories.json");
  let memories: Memory[] = [];
  if (existsSync(memoriesPath)) {
    try {
      const data = JSON.parse(
        readFileSync(memoriesPath, "utf-8")
      ) as MemoriesFile;
      memories = data.memories ?? [];
    } catch {
      ui.warn("Failed to parse memories.json");
    }
  }

  // Load patterns
  const patternsPath = resolve(config.dataDir, "patterns.json");
  let patterns: Pattern[] = [];
  if (existsSync(patternsPath)) {
    try {
      const data = JSON.parse(
        readFileSync(patternsPath, "utf-8")
      ) as PatternsFile;
      patterns = data.patterns ?? [];
    } catch {
      ui.warn("Failed to parse patterns.json");
    }
  }

  // Display memories
  if (memories.length > 0) {
    ui.showContent("Memories", buildMemorySummary(memories));
  } else {
    ui.info("No memories on file.");
  }

  // Display patterns
  if (patterns.length > 0) {
    ui.showContent("Behavioral Patterns", buildPatternSummary(patterns));
  } else {
    ui.info("No behavioral patterns on file.");
  }

  // Display session state
  const sessionSummary = buildSessionSummary(config);
  if (sessionSummary) {
    ui.showContent("Current Session", sessionSummary);
  } else {
    ui.info("No active session.");
  }

  ui.outro("Done");
}
