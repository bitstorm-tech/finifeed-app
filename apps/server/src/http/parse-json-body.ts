import { ErrorCode } from "@finifeed/shared";
import type { Context } from "hono";
import { z } from "zod";
import { AppError } from "../errors/app-error";

/** Reads and validates a JSON request body; invalid JSON or schema violations become VALIDATION_FAILED. */
export async function parseJsonBody<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new AppError(ErrorCode.VALIDATION_FAILED, "Request body must be valid JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(ErrorCode.VALIDATION_FAILED, z.prettifyError(parsed.error));
  }
  return parsed.data;
}
