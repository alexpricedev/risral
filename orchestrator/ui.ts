import * as p from "@clack/prompts";
import pc from "picocolors";

export function intro(): void {
  console.log();
  p.intro(pc.bgCyan(pc.black(" RISRAL ")));
}

export function outro(message: string): void {
  p.outro(pc.green(message));
}

export function phaseIntro(name: string, description?: string): void {
  const label = pc.bold(pc.cyan(name));
  const detail = description ? pc.dim(` — ${description}`) : "";
  p.log.step(`${label}${detail}`);
}

export function showContent(
  title: string,
  content: string,
  filePath?: string,
  maxLines = 40,
): void {
  const lines = content.split("\n");
  if (lines.length > maxLines && filePath) {
    const truncated = lines.slice(0, maxLines).join("\n");
    p.note(
      truncated +
        `\n\n${pc.dim(`... ${lines.length - maxLines} more lines — see ${filePath}`)}`,
      title,
    );
  } else {
    p.note(content, title);
  }
}

export async function collectIntent(): Promise<string | symbol> {
  return p.text({
    message: "What do you want to achieve in this session?",
    placeholder:
      "Describe your intent — what you want built, changed, or fixed",
    validate: (value) => {
      if (!value || value.trim().length < 10) {
        return "Please provide a clear intent (at least 10 characters)";
      }
    },
  });
}

export async function collectFeedback(
  prompt: string,
): Promise<string | symbol> {
  return p.text({
    message: prompt,
    placeholder: "Type your response...",
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return "Please provide a response";
      }
    },
  });
}

export async function confirmAction(
  message: string,
): Promise<boolean | symbol> {
  return p.confirm({ message });
}

export async function selectOption<T extends string>(
  message: string,
  options: { value: T; label: string; hint?: string }[],
): Promise<T | symbol> {
  return p.select({ message, options });
}

let activeSpinner: ReturnType<typeof p.spinner> | null = null;

export function startSpinner(message: string): void {
  activeSpinner = p.spinner();
  activeSpinner.start(message);
}

export function updateSpinner(message: string): void {
  if (activeSpinner) {
    activeSpinner.message(message);
  }
}

export function stopSpinner(message?: string): void {
  if (activeSpinner) {
    activeSpinner.stop(message);
    activeSpinner = null;
  }
}

export function success(message: string): void {
  p.log.success(message);
}

export function warn(message: string): void {
  p.log.warn(message);
}

export function info(message: string): void {
  p.log.info(message);
}

export function error(message: string): void {
  p.log.error(message);
}

export function handleCancel(value: unknown): value is symbol {
  if (p.isCancel(value)) {
    p.cancel("Session cancelled.");
    process.exit(0);
  }
  return false;
}
