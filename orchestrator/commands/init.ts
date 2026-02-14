// RISRAL — Init Command
//
// Project setup: verifies environment, creates data directory with empty stores,
// collects project intent via guided questions.

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import type { RisralConfig } from "../types.ts";
import * as ui from "../ui.ts";

function cancelGuard(value: unknown): asserts value is string | boolean {
  if (p.isCancel(value)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }
}

export async function runInitCommand(config: RisralConfig): Promise<void> {
  ui.intro();
  p.log.step(pc.bold(pc.cyan("Project Setup")));

  // 1. Check environment
  p.log.step("Checking environment");

  const claudeCheck = Bun.spawnSync(["claude", "--version"]);
  if (claudeCheck.exitCode !== 0) {
    p.log.error(
      "Claude CLI not found. Install it first: https://docs.claude.com",
    );
    process.exit(1);
  }
  p.log.success(`Claude CLI ${claudeCheck.stdout.toString().trim()}`);
  p.log.success(`Bun ${Bun.version}`);

  // 2. Verify framework files
  p.log.step("Checking framework files");

  const requiredFiles = [
    "CLAUDE.md",
    "cross-check-mandate.md",
    "onboarding-protocol.md",
  ];

  for (const file of requiredFiles) {
    const path = resolve(config.frameworkDir, file);
    if (!existsSync(path)) {
      p.log.error(`Missing: framework/${file}`);
      process.exit(1);
    }
    p.log.success(`framework/${file}`);
  }

  // 3. Create data directory with empty stores
  p.log.step("Setting up data directory");

  if (!existsSync(config.dataDir)) {
    mkdirSync(config.dataDir, { recursive: true });
  }

  const memoriesPath = resolve(config.dataDir, "memories.json");
  const patternsPath = resolve(config.dataDir, "patterns.json");

  if (!existsSync(memoriesPath)) {
    const memoriesTemplate = {
      schema_version: "1.0.0",
      project: "",
      created: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      memories: [],
    };
    writeFileSync(memoriesPath, JSON.stringify(memoriesTemplate, null, 2));
    p.log.success("Created data/memories.json");
  } else {
    p.log.success("data/memories.json already exists");
  }

  if (!existsSync(patternsPath)) {
    const patternsTemplate = {
      schema_version: "1.0.0",
      description:
        "Portable behavioral patterns — these travel across projects.",
      last_updated: new Date().toISOString(),
      patterns: [],
    };
    writeFileSync(patternsPath, JSON.stringify(patternsTemplate, null, 2));
    p.log.success("Created data/patterns.json");
  } else {
    p.log.success("data/patterns.json already exists");
  }

  // 4. Collect project intent via guided questions
  const intentPath = resolve(config.dataDir, "project-intent.md");

  if (existsSync(intentPath)) {
    const existing = readFileSync(intentPath, "utf-8");
    const preview = existing.split("\n").slice(0, 10).join("\n");
    p.note(preview, "Existing project intent");

    const redo = await p.confirm({
      message: "Update the project intent?",
    });
    cancelGuard(redo);

    if (!redo) {
      p.log.success("Keeping existing project intent");
      finishSetup(config);
      return;
    }
  }

  p.note(
    [
      "These questions help the AI understand what you're trying to achieve.",
      "Focus on outcomes and problems — not technical details or specific features.",
      "This is set once and guides every session.",
    ].join("\n"),
    "Project Intent",
  );

  const what = await p.text({
    message: "What is this project? Who is it for? What problem does it solve?",
    placeholder: "e.g. A tool that helps small teams manage inventory without needing a developer",
    validate: (v) => {
      if (!v || v.trim().length < 10) return "Tell the AI what this project is about";
    },
  });
  cancelGuard(what);

  const why = await p.text({
    message: "Why does it matter? What changes if this succeeds?",
    placeholder: "e.g. Teams stop losing track of stock and wasting money on over-ordering",
    validate: (v) => {
      if (!v || v.trim().length < 10) return "Describe why this project matters";
    },
  });
  cancelGuard(why);

  const success = await p.text({
    message: "What does success look like? Describe concrete outcomes, not features.",
    placeholder: "e.g. Operators trust the system's recommendations enough to act on them without checking",
    validate: (v) => {
      if (!v || v.trim().length < 10) return "Describe what success looks like";
    },
  });
  cancelGuard(success);

  const quality = await p.text({
    message: "What does quality mean here? What standard are you holding to?",
    placeholder: "e.g. It should feel reliable — no surprises, no data loss, clear about what it's doing",
    validate: (v) => {
      if (!v || v.trim().length < 10) return "Describe what quality means for this project";
    },
  });
  cancelGuard(quality);

  const notThis = await p.text({
    message: "What is this project NOT? What's deliberately out of scope?",
    placeholder: "e.g. Not a mobile app, not for enterprise, not a replacement for their accountant",
    validate: (v) => {
      if (!v || v.trim().length < 10) return "Describe what this project is not";
    },
  });
  cancelGuard(notThis);

  // Assemble and save
  const intentDoc = [
    "# Project Intent",
    "",
    "## What this project is",
    "",
    what,
    "",
    "## Why it matters",
    "",
    why,
    "",
    "## What success looks like",
    "",
    success,
    "",
    "## What quality means here",
    "",
    quality,
    "",
    "## What this project is NOT",
    "",
    notThis,
    "",
  ].join("\n");

  writeFileSync(intentPath, intentDoc);
  p.log.success("Project intent saved to data/project-intent.md");

  // Update memories.json project name from the first line of "what"
  if (what) {
    try {
      const memories = JSON.parse(readFileSync(memoriesPath, "utf-8"));
      memories.project = what.split("\n")[0].slice(0, 100);
      writeFileSync(memoriesPath, JSON.stringify(memories, null, 2));
    } catch {
      // Not critical — skip silently
    }
  }

  finishSetup(config);
}

function finishSetup(config: RisralConfig): void {
  p.note(
    [
      `To start a planning session:`,
      `  bun run plan`,
      ``,
      `The orchestrator will:`,
      `  1. Ask for your session intent`,
      `  2. Backbrief — AI reflects understanding, asks questions`,
      `  3. Plan — AI picks the best approach`,
      `  4. Cross-check — adversarial review`,
      `  5. Output a plan to paste into Claude Code CLI`,
      ``,
      `After executing the plan:`,
      `  bun run learn     Feed outcomes back into reputation`,
      `  bun run status    View your reputation state`,
    ].join("\n"),
    "Ready",
  );

  p.outro(pc.green("RISRAL is ready."));
}
