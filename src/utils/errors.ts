export class TodoistMcpError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "TodoistMcpError";
  }
}

export function formatError(err: unknown): string {
  if (err instanceof TodoistMcpError) {
    return `${err.message}${err.cause ? `: ${describeCause(err.cause)}` : ""}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

function describeCause(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === "object" && cause !== null) {
    try {
      return JSON.stringify(cause);
    } catch {
      return String(cause);
    }
  }
  return String(cause);
}
