// RISRAL Orchestrator — Memory Loader
//
// Loads memories and patterns from disk, filters out deprecated/low-confidence
// entries, sorts by priority, and formats as markdown for prompt injection.
// Replaces raw JSON dumping with structured, token-efficient output.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { RisralConfig } from "./types.ts";

// --- Memory types ---

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
  last_reinforced: string;
  created: string;
  tags: string[];
  related_memories: string[];
  status: "active" | "deprecated" | "challenged";
}

interface MemoriesFile {
  schema_version: string;
  project: string;
  created: string;
  last_updated: string;
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
  last_reinforced: string;
  created: string;
  origin: string;
  status: "active" | "deprecated" | "challenged";
}

interface PatternsFile {
  schema_version: string;
  description: string;
  last_updated: string;
  patterns: Pattern[];
  _schema?: unknown;
}

// --- Priority ordering ---

const MEMORY_TYPE_PRIORITY: Record<Memory["type"], number> = {
  false_belief: 0,
  drift_event: 1,
  decision: 2,
  pattern: 3,
  observation: 4,
};

// --- Filtering ---

function isMemoryIncluded(mem: Memory): boolean {
  if (mem.status === "deprecated") return false;
  if (mem.confidence.score < 0.2) return false;
  return true;
}

function isPatternIncluded(pat: Pattern): boolean {
  if (pat.status === "deprecated") return false;
  return true;
}

// --- Sorting ---

function memoryPriorityScore(mem: Memory): number {
  return mem.confidence.score * (mem.reinforcement_count + 1);
}

function compareMemories(a: Memory, b: Memory): number {
  // First sort by type priority (false_belief first)
  const typeDiff = MEMORY_TYPE_PRIORITY[a.type] - MEMORY_TYPE_PRIORITY[b.type];
  if (typeDiff !== 0) return typeDiff;
  // Within same type, sort by priority score descending
  return memoryPriorityScore(b) - memoryPriorityScore(a);
}

function comparePatterns(a: Pattern, b: Pattern): number {
  // Sort by confidence descending
  return b.confidence.score - a.confidence.score;
}

// --- Markdown formatting ---

function memoryTypeLabel(type: Memory["type"]): string {
  switch (type) {
    case "false_belief": return "FALSE BELIEF";
    case "drift_event": return "DRIFT EVENT";
    case "decision": return "DECISION";
    case "pattern": return "PATTERN";
    case "observation": return "OBSERVATION";
  }
}

function formatMemory(mem: Memory): string {
  const statusTag = mem.status === "challenged" ? " [CHALLENGED]" : "";
  const confidence = `${(mem.confidence.score * 100).toFixed(0)}%`;
  const reinforced = mem.reinforcement_count > 0
    ? ` | reinforced ${mem.reinforcement_count}x`
    : "";

  return `### ${mem.id}: ${memoryTypeLabel(mem.type)}${statusTag}
**Confidence:** ${confidence}${reinforced} | **Source:** ${mem.source}
**Context:** ${mem.context}

${mem.content}`;
}

function formatPattern(pat: Pattern): string {
  const confidence = `${(pat.confidence.score * 100).toFixed(0)}%`;
  const reinforced = pat.reinforcement_count > 0
    ? ` | reinforced ${pat.reinforcement_count}x`
    : "";

  return `### ${pat.id}: ${pat.category.toUpperCase()}
**Confidence:** ${confidence}${reinforced} | **Origin:** ${pat.origin}

${pat.content}

**Countermeasure:** ${pat.countermeasure}`;
}

// --- Public API ---

/**
 * Load memories from disk, filter, sort by priority, and format as markdown.
 *
 * - Excludes deprecated memories
 * - Excludes memories with confidence < 0.2
 * - Sorts: false_belief > drift_event > decision > pattern > observation
 * - Within each type: sorts by confidence * (reinforcement_count + 1) descending
 * - Strips _schema block
 * - Returns formatted markdown (not raw JSON)
 */
export function loadMemories(config: RisralConfig): string {
  const path = resolve(config.dataDir, "memories.json");
  if (!existsSync(path)) return "*No memories on file.*";

  let data: MemoriesFile;
  try {
    data = JSON.parse(readFileSync(path, "utf-8")) as MemoriesFile;
  } catch {
    return "*Failed to parse memories.json.*";
  }

  if (!data.memories || data.memories.length === 0) {
    return "*No memories on file.*";
  }

  const included = data.memories.filter(isMemoryIncluded);
  if (included.length === 0) {
    return "*All memories are deprecated or below confidence threshold.*";
  }

  included.sort(compareMemories);

  const sections = included.map(formatMemory);

  return `**${included.length} active memories** (${data.memories.length - included.length} excluded)\n\n${sections.join("\n\n---\n\n")}`;
}

/**
 * Load patterns from disk, filter, sort by confidence, and format as markdown.
 *
 * - Excludes deprecated patterns
 * - Sorts by confidence descending
 * - Strips _schema block
 * - Returns formatted markdown (not raw JSON)
 */
export function loadPatterns(config: RisralConfig): string {
  const path = resolve(config.dataDir, "patterns.json");
  if (!existsSync(path)) return "*No behavioral patterns on file.*";

  let data: PatternsFile;
  try {
    data = JSON.parse(readFileSync(path, "utf-8")) as PatternsFile;
  } catch {
    return "*Failed to parse patterns.json.*";
  }

  if (!data.patterns || data.patterns.length === 0) {
    return "*No behavioral patterns on file.*";
  }

  const included = data.patterns.filter(isPatternIncluded);
  if (included.length === 0) {
    return "*All patterns are deprecated.*";
  }

  included.sort(comparePatterns);

  const sections = included.map(formatPattern);

  return `**${included.length} active patterns**\n\n${sections.join("\n\n---\n\n")}`;
}
