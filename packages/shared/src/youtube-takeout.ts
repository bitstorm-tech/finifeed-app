import { z } from "zod";
import { FollowedCreatorSchema } from "./creators";

export const YOUTUBE_CHANNEL_ID_PATTERN = /^UC[\w-]{22}$/;
export const YouTubeChannelIdSchema = z.string().regex(YOUTUBE_CHANNEL_ID_PATTERN, "Not a YouTube channel ID");

/** A Takeout export of a few thousand subscriptions is well below 1 MB. */
export const TAKEOUT_CSV_MAX_LENGTH = 2_000_000;

/** Channels per import request; the client splits larger selections and shows progress. */
export const TAKEOUT_IMPORT_BATCH_SIZE = 100;

/**
 * `POST /api/v1/integrations/youtube/takeout/preview` — parses the `subscriptions.csv` of a Google Takeout
 * export. Nothing is stored and YouTube is not called; the user picks what to follow from the result.
 */
export const TakeoutPreviewRequestSchema = z.object({
  csv: z.string().min(1).max(TAKEOUT_CSV_MAX_LENGTH),
});
export type TakeoutPreviewRequest = z.infer<typeof TakeoutPreviewRequestSchema>;

export const TakeoutChannelSchema = z.object({
  channelId: YouTubeChannelIdSchema,
  /** The title as written in the export; it may be outdated. */
  title: z.string(),
  canonicalUrl: z.url(),
  /** Subscription ID if the current user already follows this channel in Finifeed. */
  subscriptionId: z.uuid().nullable(),
});
export type TakeoutChannel = z.infer<typeof TakeoutChannelSchema>;

export const TakeoutPreviewResponseSchema = z.object({
  /** Unique channels, alphabetically by title. */
  channels: z.array(TakeoutChannelSchema),
});
export type TakeoutPreviewResponse = z.infer<typeof TakeoutPreviewResponseSchema>;

/** `POST /api/v1/integrations/youtube/takeout/import` — follows the selected channels. Idempotent. */
export const TakeoutImportRequestSchema = z.object({
  channelIds: z.array(YouTubeChannelIdSchema).min(1).max(TAKEOUT_IMPORT_BATCH_SIZE),
});
export type TakeoutImportRequest = z.infer<typeof TakeoutImportRequestSchema>;

export const TakeoutImportResponseSchema = z.object({
  /** Creators the user did not follow before this request. */
  followed: z.array(FollowedCreatorSchema),
  alreadyFollowingCount: z.number().int().nonnegative(),
  /** Channels YouTube no longer knows, e.g. deleted or terminated ones. */
  notFoundChannelIds: z.array(YouTubeChannelIdSchema),
});
export type TakeoutImportResponse = z.infer<typeof TakeoutImportResponseSchema>;
