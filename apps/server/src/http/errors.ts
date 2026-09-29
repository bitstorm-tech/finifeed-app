import { ErrorCode, type ErrorResponse } from "@finifeed/shared";
import type { Context, ErrorHandler, NotFoundHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { AppError } from "../errors/app-error";
import type { AppEnv } from "./app-env";

const STATUS_BY_CODE: Record<ErrorCode, ContentfulStatusCode> = {
  CREATOR_NOT_FOUND: 404,
  SOURCE_TEMPORARILY_UNAVAILABLE: 503,
  SOURCE_RATE_LIMITED: 429,
  ALREADY_FOLLOWING: 409,
  CONTENT_NOT_AVAILABLE: 404,
  INVALID_SOURCE_INPUT: 400,
  VALIDATION_FAILED: 400,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
};

export function errorResponse(
  c: Context<AppEnv>,
  status: ContentfulStatusCode,
  code: ErrorCode,
  message: string,
) {
  const body: ErrorResponse = { error: { code, message, requestId: c.get("requestId") } };
  return c.json(body, status);
}

export const handleNotFound: NotFoundHandler<AppEnv> = (c) =>
  errorResponse(c, 404, ErrorCode.NOT_FOUND, "Route not found");

/** Maps AppErrors to their status; anything else is logged and answered without internals. */
export const handleError: ErrorHandler<AppEnv> = (error, c) => {
  if (error instanceof AppError) {
    const status = STATUS_BY_CODE[error.code];
    c.get("logger")[status >= 500 ? "warn" : "info"]({ code: error.code, cause: error.cause }, error.message);
    return errorResponse(c, status, error.code, error.message);
  }
  c.get("logger").error({ err: error }, "unhandled error");
  return errorResponse(c, 500, ErrorCode.INTERNAL_ERROR, "Internal server error");
};
