import { ErrorCode, type ErrorResponse } from "@finifeed/shared";
import type { Context, ErrorHandler, NotFoundHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppEnv } from "./app-env";

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

/** Last-resort handler: logs the error, never leaks internals to the client. */
export const handleError: ErrorHandler<AppEnv> = (error, c) => {
  c.get("logger").error({ err: error }, "unhandled error");
  return errorResponse(c, 500, ErrorCode.INTERNAL_ERROR, "Internal server error");
};
