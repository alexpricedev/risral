// RISRAL — Init Command (stub)
//
// Project setup: creates data directory, collects project intent, verifies environment.
// Currently delegates to bin/init.ts. Task 8 will move the logic here.

import type { RisralConfig } from "../types.ts";
import * as ui from "../ui.ts";

export async function runInitCommand(_config: RisralConfig): Promise<void> {
  ui.intro();
  ui.info("Delegating to bin/init.ts for project setup.");
  ui.info("Run 'bun run bin/init.ts' directly for now.");
  ui.outro("Use 'bun run init' for project setup");
}
