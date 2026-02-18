#!/usr/bin/env bun

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";

const pkgPath = resolve(import.meta.dirname!, "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
const current = pkg.version;

console.log();
p.intro(pc.bgCyan(pc.black(" publish ")));
p.log.info(`Current version: ${pc.bold(current)}`);

const [major, minor, patch] = current.split(".").map(Number);

const bump = await p.select({
  message: "Version bump?",
  options: [
    { value: "patch", label: `patch → ${major}.${minor}.${patch + 1}` },
    { value: "minor", label: `minor → ${major}.${minor + 1}.0` },
    { value: "major", label: `major → ${major + 1}.0.0` },
  ],
});

if (p.isCancel(bump)) {
  p.cancel("Cancelled.");
  process.exit(0);
}

const next =
  bump === "patch" ? `${major}.${minor}.${patch + 1}` :
  bump === "minor" ? `${major}.${minor + 1}.0` :
  `${major + 1}.0.0`;

pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

execSync(`git add package.json && git commit -m "chore: bump version to ${next}"`, { stdio: "inherit" });
execSync(`git tag v${next}`, { stdio: "inherit" });
execSync("npm publish", { stdio: "inherit" });
execSync(`git push && git push --tags`, { stdio: "inherit" });

p.outro(`Published ${pc.bold(`risral@${next}`)}`);
