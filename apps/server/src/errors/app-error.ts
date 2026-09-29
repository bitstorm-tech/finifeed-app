import type { ErrorCode } from "@finifeed/shared";

/**
 * An expected failure with a client-facing code and message (spec §26).
 * The HTTP layer maps the code to a status; `cause` is logged, never sent to the client.
 */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AppError";
  }
}
