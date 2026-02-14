// RISRAL — Status Command (stub)
//
// Displays the current state of the reputation system.
// Full implementation in Task 7.

import type { RisralConfig } from "../types.ts";
import * as ui from "../ui.ts";

export async function runStatusCommand(config: RisralConfig): Promise<void> {
  ui.intro();
  ui.warn("The 'status' command is not yet implemented.");
  ui.info("This will display your current memories and behavioral patterns.");
  ui.outro("Coming soon");
}
