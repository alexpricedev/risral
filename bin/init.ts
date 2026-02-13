#!/usr/bin/env bun

// RISRAL Init — Project Setup
//
// Run this after cloning RISRAL into your project.
// Sets up the data directory with empty memory stores
// and verifies the environment is ready.

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createInterface } from "node:readline";

// bin/init.ts → ../ = repo root
const ROOT = resolve(import.meta.dirname!, "..");
const FRAMEWORK_DIR = resolve(ROOT, "framework");
const DATA_DIR = resolve(ROOT, "data");

const rl = createInterface({ input: process.stdin, output: process.stdout });
function ask(q: string): Promise<string> {
  return new Promise((r) => rl.question(q, (a) => r(a.trim())));
}

async function main() {
  console.log("\n  RISRAL — Project Setup\n");

  // 1. Check environment
  console.log("  Checking environment...");

  const claudeCheck = Bun.spawnSync(["claude", "--version"]);
  if (claudeCheck.exitCode !== 0) {
    console.error("  ✗ Claude CLI not found. Install it first: https://docs.claude.com");
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
    // Read the schema template from the existing file or create fresh
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
      description: "Portable behavioral patterns — these travel across projects.",
      last_updated: new Date().toISOString(),
      patterns: [],
    };
    writeFileSync(patternsPath, JSON.stringify(patternsTemplate, null, 2));
    console.log("  ✓ Created data/patterns.json (empty)");
  } else {
    console.log("  ✓ data/patterns.json already exists");
  }

  // 4. Check if CLAUDE.md intent section is filled in
  console.log("\n  Checking project intent...");

  const claudeMd = readFileSync(resolve(FRAMEWORK_DIR, "CLAUDE.md"), "utf-8");
  const hasIntent = !claudeMd.includes("<!-- What are we building?");

  if (!hasIntent) {
    console.log("  ⚠ The intent section in framework/CLAUDE.md is still the template.");
    console.log("  You should fill it in before running the orchestrator.");
    const openNow = await ask("\n  Open CLAUDE.md to fill in the intent now? (y/n): ");

    if (openNow.toLowerCase().startsWith("y")) {
      const editor = process.env.EDITOR || "vim";
      const editorProc = Bun.spawn([editor, resolve(FRAMEWORK_DIR, "CLAUDE.md")], {
        stdio: ["inherit", "inherit", "inherit"],
      });
      await editorProc.exited;
    }
  } else {
    console.log("  ✓ Project intent is filled in");
  }

  // 5. Detect project directory
  console.log("\n  Detecting project...");

  const parentDir = resolve(ROOT, "..");
  console.log(`  Project directory: ${parentDir}`);

  // 6. Done
  console.log(`
  ✓ RISRAL is ready.

  To start a session:
    cd ${ROOT}
    bun run start -- ${parentDir}

  Or from your project root:
    cd .risral && bun run start -- ../

  The orchestrator will:
    1. Ask for your intent
    2. Plan (with adversarial cross-check)
    3. Execute task-by-task (fresh context per task)
    4. Review against the plan
  `);

  rl.close();
}

main().catch((err) => {
  console.error("Init failed:", err);
  process.exit(1);
});
