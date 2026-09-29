import { ErrorCode } from "@finifeed/shared";
import type { Logger } from "pino";
import { z } from "zod";
import { AppError } from "../../errors/app-error";
import type { ChannelLookup } from "./parse-channel-input";

export const YOUTUBE_API_BASE_URL = "https://www.googleapis.com/youtube/v3";

const REQUEST_TIMEOUT_MS = 10_000;

export type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const ChannelSchema = z.object({
  id: z.string().min(1),
  snippet: z.object({
    title: z.string(),
    /** The channel's `@handle`, if it has one. */
    customUrl: z.string().optional(),
    thumbnails: z.record(z.string(), z.object({ url: z.url() })).optional(),
  }),
  contentDetails: z.object({
    relatedPlaylists: z.object({ uploads: z.string().min(1) }),
  }),
});
export type YouTubeChannel = z.infer<typeof ChannelSchema>;

const ChannelListResponseSchema = z.object({
  items: z.array(ChannelSchema).optional(),
});

const ErrorResponseSchema = z.object({
  error: z.object({
    errors: z.array(z.object({ reason: z.string() })).optional(),
  }),
});

const RATE_LIMIT_REASONS = new Set(["quotaExceeded", "rateLimitExceeded", "userRateLimitExceeded", "dailyLimitExceeded"]);

export interface YouTubeClientOptions {
  /** Without a key every call fails with SOURCE_TEMPORARILY_UNAVAILABLE. */
  apiKey: string | undefined;
  logger: Logger;
  fetch?: FetchFn;
  baseUrl?: string;
}

export interface YouTubeClient {
  /** `channels.list` (1 quota unit). Returns null if no channel matches. */
  findChannel(lookup: ChannelLookup): Promise<YouTubeChannel | null>;
}

/** Thin client for the official YouTube Data API v3 (spec §11.1). Upstream failures become AppErrors. */
export function createYouTubeClient({
  apiKey,
  logger,
  fetch: fetchFn = fetch,
  baseUrl = YOUTUBE_API_BASE_URL,
}: YouTubeClientOptions): YouTubeClient {
  const log = logger.child({ source: "YOUTUBE" });

  async function get(endpoint: string, params: Record<string, string>, quotaUnits: number): Promise<unknown> {
    if (!apiKey) {
      log.error({ endpoint }, "YOUTUBE_API_KEY is not configured");
      throw unavailable();
    }

    const url = new URL(`${baseUrl}/${endpoint}`);
    for (const [key, value] of Object.entries({ ...params, key: apiKey })) url.searchParams.set(key, value);

    let response: Response;
    try {
      response = await fetchFn(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      log.warn({ endpoint, err: error }, "YouTube request failed");
      throw unavailable(error);
    }

    // The API key is deliberately not logged.
    log.info({ endpoint, params, status: response.status, quotaUnits }, "YouTube Data API call");

    if (response.ok) return response.json();

    const reasons = ErrorResponseSchema.safeParse(await response.json().catch(() => null)).data?.error.errors?.map(
      (e) => e.reason,
    );
    log.warn({ endpoint, status: response.status, reasons }, "YouTube Data API error");
    if (response.status === 429 || reasons?.some((reason) => RATE_LIMIT_REASONS.has(reason))) {
      throw new AppError(ErrorCode.SOURCE_RATE_LIMITED, "YouTube is rate limiting requests. Please try again later.");
    }
    throw unavailable();
  }

  return {
    async findChannel(lookup) {
      const params: Record<string, string> = { part: "snippet,contentDetails" };
      if (lookup.by === "handle") params.forHandle = `@${lookup.handle}`;
      else if (lookup.by === "id") params.id = lookup.channelId;
      else params.forUsername = lookup.username;

      const body = await get("channels", params, 1);
      const parsed = ChannelListResponseSchema.safeParse(body);
      if (!parsed.success) {
        log.error({ issues: parsed.error.issues }, "unexpected channels.list response");
        throw unavailable(parsed.error);
      }
      return parsed.data.items?.[0] ?? null;
    },
  };
}

function unavailable(cause?: unknown) {
  return new AppError(
    ErrorCode.SOURCE_TEMPORARILY_UNAVAILABLE,
    "YouTube is temporarily unavailable. Please try again later.",
    { cause },
  );
}
