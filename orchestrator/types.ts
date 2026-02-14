// RISRAL Orchestrator — Core Types

export type Phase = "planning" | "crosscheck" | "complete";

export type TaskStatus = "pending" | "in_progress" | "completed" | "failed";

export interface OrchestratorState {
  phase: Phase;
  totalTasks: number;
  planApproved: boolean;
  startedAt: string;
  lastUpdated: string;
}

export interface RisralConfig {
  /** Path to the framework directory (contains CLAUDE.md, cross-check-mandate.md, etc.) */
  frameworkDir: string;
  /** Path to the data directory (contains memories.json, patterns.json) */
  dataDir: string;
  /** Path to the project directory the AI will work in */
  projectDir: string;
  /** Path to the session working directory */
  sessionDir: string;
  /** Claude CLI model to use */
  model?: string;
  /** Max budget per invocation in USD */
  maxBudgetPerInvocation?: number;
  /** Whether to skip permission checks (for sandboxed environments) */
  skipPermissions?: boolean;
  /** Allowed tools for CLI invocations */
  allowedTools?: string[];
}

export interface Task {
  index: number;
  title: string;
  description: string;
  status: TaskStatus;
  completedAt?: string;
}

export interface ClaudeInvocation {
  systemPrompt: string;
  userPrompt: string;
  workingDir: string;
  additionalDirs?: string[];
  model?: string;
  maxBudget?: number;
  skipPermissions?: boolean;
  allowedTools?: string[];
  outputFormat?: "text" | "json" | "stream-json";
}

export interface CrossCheckFinding {
  dimension: string;
  finding: string;
  evidence: string;
  scoreAction: string;
}

export interface CrossCheckResult {
  findings: CrossCheckFinding[];
  recommendation: "APPROVE" | "REVISE" | "ESCALATE";
  summary: string;
}
