import { z } from "zod";

/** Only YouTube is implemented in the MVP (spec §5.1). */
export const SourceTypeSchema = z.enum(["YOUTUBE"]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

/** `POST /api/v1/creators/resolve` — resolves a handle or channel URL without following it. */
export const ResolveCreatorRequestSchema = z.object({
  sourceType: SourceTypeSchema,
  input: z.string().trim().min(1).max(500),
});
export type ResolveCreatorRequest = z.infer<typeof ResolveCreatorRequestSchema>;

export const SourceAccountSummarySchema = z.object({
  id: z.uuid(),
  sourceType: SourceTypeSchema,
  handle: z.string().nullable(),
  displayName: z.string(),
  canonicalUrl: z.url(),
});
export type SourceAccountSummary = z.infer<typeof SourceAccountSummarySchema>;

export const CreatorCandidateSchema = z.object({
  creatorId: z.uuid(),
  displayName: z.string(),
  avatarUrl: z.url().nullable(),
  source: SourceAccountSummarySchema,
  /** Subscription ID if the current user already follows this creator. */
  subscriptionId: z.uuid().nullable(),
});
export type CreatorCandidate = z.infer<typeof CreatorCandidateSchema>;

/** `POST /api/v1/subscriptions` — follows a creator returned by resolve. Idempotent. */
export const FollowCreatorRequestSchema = z.object({
  creatorId: z.uuid(),
});
export type FollowCreatorRequest = z.infer<typeof FollowCreatorRequestSchema>;

export const FollowedCreatorSchema = z.object({
  subscriptionId: z.uuid(),
  creatorId: z.uuid(),
  displayName: z.string(),
  avatarUrl: z.url().nullable(),
  sources: z.array(SourceAccountSummarySchema),
  followedAt: z.iso.datetime({ offset: true }),
});
export type FollowedCreator = z.infer<typeof FollowedCreatorSchema>;

/** `GET /api/v1/creators` — creators the current user follows, alphabetically. */
export const FollowedCreatorsResponseSchema = z.object({
  creators: z.array(FollowedCreatorSchema),
});
export type FollowedCreatorsResponse = z.infer<typeof FollowedCreatorsResponseSchema>;
