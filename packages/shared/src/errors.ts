import { z } from "zod";

/** Client-facing error codes (spec §26). Upstream details stay in server logs. */
export const ErrorCode = {
  CREATOR_NOT_FOUND: "CREATOR_NOT_FOUND",
  SOURCE_TEMPORARILY_UNAVAILABLE: "SOURCE_TEMPORARILY_UNAVAILABLE",
  SOURCE_RATE_LIMITED: "SOURCE_RATE_LIMITED",
  ALREADY_FOLLOWING: "ALREADY_FOLLOWING",
  CONTENT_NOT_AVAILABLE: "CONTENT_NOT_AVAILABLE",
  INVALID_SOURCE_INPUT: "INVALID_SOURCE_INPUT",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  NOT_FOUND: "NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.enum(ErrorCode),
    message: z.string(),
    requestId: z.string().optional(),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
