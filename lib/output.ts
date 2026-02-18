import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

export interface PlanSections {
  concerns: string;
  overview: string;
  technicalPlan: string;
}

/**
 * Parse the cross-check AI response into its three sections.
 */
export function parseCrossCheckResponse(response: string): PlanSections {
  const concernsMatch = response.match(/## Concerns\s*\n([\s\S]*?)(?=\n## Plan Overview)/);
  const overviewMatch = response.match(/## Plan Overview\s*\n([\s\S]*?)(?=\n## Technical Plan)/);
  const technicalMatch = response.match(/## Technical Plan\s*\n([\s\S]*?)$/);

  return {
    concerns: concernsMatch?.[1]?.trim() ?? "No concerns identified.",
    overview: overviewMatch?.[1]?.trim() ?? "No overview generated.",
    technicalPlan: technicalMatch?.[1]?.trim() ?? "No technical plan generated.",
  };
}

/**
 * Generate a filename slug from the intent.
 */
function slugify(intent: string): string {
  return intent
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

/**
 * Write the plan to plans/risral/ in the current working directory.
 * Returns the file path.
 */
export function writePlan(intent: string, sections: PlanSections): string {
  const date = new Date().toISOString().slice(0, 10);
  const slug = slugify(intent);
  const filename = `${date}-${slug}.md`;
  const dir = resolve(process.cwd(), "plans", "risral");
  const filepath = resolve(dir, filename);

  mkdirSync(dir, { recursive: true });

  const content = `# ${intent}

*Generated ${date} by RISRAL*

## Concerns

${sections.concerns}

## Plan Overview

${sections.overview}

---

## Technical Plan

${sections.technicalPlan}

---

## Execution Context

You are executing an approved plan. Follow these principles:

- **Exploring is free.** Consider multiple approaches before committing.
- **Deferral is expensive.** If something needs doing and it's in scope, do it now.
- **Thoroughness is free.** Take the time the work requires.
- When uncertain, say so. When guessing, say so.
- Follow the plan. Document any decisions that diverge from it.
`;

  writeFileSync(filepath, content);
  return filepath;
}

/**
 * Copy content to clipboard (macOS). Fails silently on other platforms.
 */
export function copyToClipboard(filepath: string): boolean {
  try {
    execSync(`cat "${filepath}" | pbcopy`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
