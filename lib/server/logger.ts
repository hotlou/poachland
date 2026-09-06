import "server-only";

type LogLevel = "info" | "warn" | "error";

function serializeError(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) return { error: String(error) };
  return { error: error.message, errorName: error.name, stack: error.stack };
}

export function log(level: LogLevel, event: string, context: Record<string, unknown> = {}): void {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...context });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.log(entry);
}

export function logError(event: string, error: unknown, context: Record<string, unknown> = {}): void {
  log("error", event, { ...context, ...serializeError(error) });
}
