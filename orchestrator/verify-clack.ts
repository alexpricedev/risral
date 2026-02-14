import * as p from "@clack/prompts";
import pc from "picocolors";

async function main() {
  p.intro(pc.bgCyan(pc.black(" RISRAL Clack Verification ")));

  // Test 1: text() input
  const name = await p.text({
    message: "Test text input — type anything and press Enter:",
    placeholder: "hello from clack",
    validate: (value) => {
      if (!value) return "Please enter something";
    },
  });

  if (p.isCancel(name)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }
  p.log.success(`text() works: received "${name}"`);

  // Test 2: confirm()
  const confirmed = await p.confirm({
    message: "Test confirm — select Yes or No:",
  });

  if (p.isCancel(confirmed)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }
  p.log.success(`confirm() works: received ${confirmed}`);

  // Test 3: select()
  const choice = await p.select({
    message: "Test select — pick an option:",
    options: [
      { value: "a", label: "Option A" },
      { value: "b", label: "Option B" },
      { value: "c", label: "Option C" },
    ],
  });

  if (p.isCancel(choice)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }
  p.log.success(`select() works: received "${choice}"`);

  // Test 4: spinner()
  const s = p.spinner();
  s.start("Testing spinner (2 seconds)...");
  await new Promise((resolve) => setTimeout(resolve, 1000));
  s.message("Still spinning (1 second left)...");
  await new Promise((resolve) => setTimeout(resolve, 1000));
  s.stop("spinner() works: completed successfully");

  // Test 5: note()
  p.note(
    "This is a multi-line note.\nIt should render inside a box.\nWith proper formatting.",
    "Test Note"
  );
  p.log.success("note() works");

  // Test 6: picocolors
  p.log.info(
    `picocolors: ${pc.bold("bold")} ${pc.dim("dim")} ${pc.cyan("cyan")} ${pc.green("green")} ${pc.yellow("yellow")} ${pc.red("red")}`
  );
  p.log.success("picocolors works");

  p.outro(pc.green("All Clack primitives verified under Bun."));
}

main().catch((err) => {
  console.error("VERIFICATION FAILED:", err);
  process.exit(1);
});
