// RISRAL — Learn Command (stub)
//
// Feeds execution outcomes back into the reputation system.
// Full implementation in Task 6.

import type { RisralConfig } from "../types.ts";
import * as ui from "../ui.ts";

export async function runLearnCommand(config: RisralConfig): Promise<void> {
  ui.intro();
  ui.warn("The 'learn' command is not yet implemented.");
  ui.info("This will allow you to feed execution outcomes back into the reputation system.");
  ui.outro("Coming soon");
}
