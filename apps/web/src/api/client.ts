import { type ErrorCode, ErrorResponseSchema } from "@finifeed/shared";
import type { z } from "zod";

/** A failed API call with a message that can be shown to the user. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: ErrorCode | "NETWORK_ERROR",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Calls `/api/v1{path}` and validates the JSON response. Throws ApiError on any failure. */
export async function apiRequest<T extends z.ZodType>(
  path: string,
  schema: T,
  init: { method?: string; body?: unknown } = {},
): Promise<z.infer<T>> {
  const response = await send(path, init);
  const parsed = schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new ApiError("The server sent an unexpected response.", "INTERNAL_ERROR");
  return parsed.data;
}

/** For endpoints without a response body (204). */
export async function apiRequestNoContent(path: string, init: { method?: string; body?: unknown } = {}): Promise<void> {
  await send(path, init);
}

async function send(path: string, { method = "GET", body }: { method?: string; body?: unknown }): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", "NETWORK_ERROR");
  }
  if (response.ok) return response;

  const error = ErrorResponseSchema.safeParse(await response.json().catch(() => null));
  throw error.success
    ? new ApiError(error.data.error.message, error.data.error.code)
    : new ApiError("Something went wrong. Please try again.", "INTERNAL_ERROR");
}
