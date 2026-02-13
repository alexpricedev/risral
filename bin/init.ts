#!/usr/bin/env bun

// RISRAL Init — Project Setup
//
// Run this after cloning RISRAL into your project.
// Sets up the data directory, collects project intent via
// guided questions, and verifies the environment is ready.

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

// bin/init.ts → ../ = repo root
const ROOT = resolve(import.meta.dirname!, "..");
const FRAMEWORK_DIR = resolve(ROOT, "framework");
const DATA_DIR = resolve(ROOT, "data");

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(q: string): Promise<string> {
  return new Promise((r) => rl.question(q, (a) => r(a.trim())));
}

async function askMultiline(prompt: string): Promise<string> {
  console.log(prompt);
  console.log("  (Enter an empty line when done)\n");
  const lines: string[] = [];
  while (true) {
    const line = await ask("  ");
    if (line === "") break;
    lines.push(line);
  }
  return lines.join("\n");
}

async function main() {
  console.log("\n  RISRAL — Project Setup\n");

  // 1. Check environment
  console.log("  Checking environment...");

  const claudeCheck = Bun.spawnSync(["claude", "--version"]);
  if (claudeCheck.exitCode !== 0) {
    console.error(
      "  ✗ Claude CLI not found. Install it first: https://docs.claude.com"
    );
    process.exit(1);
  }
  console.log(`  ✓ Claude CLI ${claudeCheck.stdout.toString().trim()}`);
  console.log(`  ✓ Bun ${Bun.version}`);

  // 2. Verify framework files
  console.log("\n  Checking framework files...");

  const requiredFiles = [
    "CLAUDE.md",
    "cross-check-mandate.md",
    "onboarding-protocol.md",
  ];

  for (const file of requiredFiles) {
    const path = resolve(FRAMEWORK_DIR, file);
    if (!existsSync(path)) {
      console.error(`  ✗ Missing: framework/${file}`);
      process.exit(1);
    }
    console.log(`  ✓ framework/${file}`);
  }

  // 3. Create data directory with empty stores
  console.log("\n  Setting up data directory...");

  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  const memoriesPath = resolve(DATA_DIR, "memories.json");
  const patternsPath = resolve(DATA_DIR, "patterns.json");

  if (!existsSync(memoriesPath)) {
    const memoriesTemplate = {
      schema_version: "1.0.0",
      project: "",
      created: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      memories: [],
    };
    writeFileSync(memoriesPath, JSON.stringify(memoriesTemplate, null, 2));
    console.log("  ✓ Created data/memories.json (empty)");
  } else {
    console.log("  ✓ data/memories.json already exists");
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
    console.log("  ✓ Created data/patterns.json (empty)");
  } else {
    console.log("  ✓ data/patterns.json already exists");
  }

  // 4. Collect project intent via guided questions
  const intentPath = resolve(DATA_DIR, "project-intent.md");

  if (existsSync(intentPath)) {
    console.log("\n  Project intent already exists:");
    console.log("");
    const existing = readFileSync(intentPath, "utf-8");
    // Show first few lines as preview
    const preview = existing.split("\n").slice(0, 8).join("\n");
    console.log(
      preview
        .split("\n")
        .map((l) => `    ${l}`)
        .join("\n")
    );
    if (existing.split("\n").length > 8) console.log("    ...");
    console.log("");

    const redo = await ask("  Update the project intent? (y/n): ");
    if (!redo.toLowerCase().startsWith("y")) {
      console.log("  ✓ Keeping existing project intent");
      finishSetup();
      return;
    }
  }

  console.log("\n  ── Project Intent ──");
  console.log(
    "  These questions define your project for the AI. Be specific about"
  );
  console.log("  outcomes, not features. This is collected once and persists");
  console.log("  across sessions.\n");

  const what = await askMultiline(
    "  What is this project? Who is it for? What problem does it solve?"
  );

  const why = await askMultiline(
    "  Why does it matter? What changes if this succeeds?"
  );

  const success = await askMultiline(
    "  What does success look like? (Concrete, measurable outcomes — not features.)"
  );

  const quality = await askMultiline(
    "  What does quality mean here? What standard are you holding to?"
  );

  const notThis = await askMultiline(
    "  What is this project NOT? What's deliberately out of scope?"
  );

  const techContext = await askMultiline(
    "  Any technical context the AI should know?\n  (Languages, frameworks, constraints, existing architecture — or press Enter to skip)"
  );

  // Assemble and save
  const intentDoc = [
    "# Project Intent",
    "",
    "## What this project is",
    "",
    what || "_Not provided._",
    "",
    "## Why it matters",
    "",
    why || "_Not provided._",
    "",
    "## What success looks like",
    "",
    success || "_Not provided._",
    "",
    "## What quality means here",
    "",
    quality || "_Not provided._",
    "",
    "## What this project is NOT",
    "",
    notThis || "_Not provided._",
    "",
    ...(techContext
      ? ["## Technical context", "", techContext, ""]
      : []),
  ].join("\n");

  writeFileSync(intentPath, intentDoc);
  console.log("\n  ✓ Project intent saved to data/project-intent.md");

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

  finishSetup();

  function finishSetup() {
    const parentDir = resolve(ROOT, "..");

    console.log(`
  ✓ RISRAL is ready.

  To start a session:
    cd ${ROOT}
    bun run start -- ${parentDir}

  Or from your project root:
    cd .risral && bun run start -- ../

  The orchestrator will:
    1. Ask for your session intent (what you're doing today)
    2. Backbrief (AI reflects understanding, asks questions)
    3. Plan (AI picks the best approach)
    4. Cross-check (adversarial review)
    5. Execute task-by-task (fresh context per task)
    6. Review against the plan
  `);

    rl.close();
  }
}

main().catch((err) => {
  console.error("Init failed:", err);
  process.exit(1);
});
