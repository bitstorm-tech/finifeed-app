import type { SourceType } from "@finifeed/shared";

/** A source account as resolved from the upstream platform, already normalized (spec §10.2). */
export interface ResolvedSourceAccount {
  sourceType: SourceType;
  externalId: string;
  handle: string | null;
  displayName: string;
  canonicalUrl: string;
  avatarUrl: string | null;
  /** Adapter-specific data persisted in `source_accounts.source_metadata`. */
  metadata: Record<string, unknown>;
}

/**
 * The boundary between platform-specific code and the rest of Finifeed (spec §10.1).
 * `fetchRecentContent` is added with content sync in Slice 2.
 */
export interface ContentSourceAdapter {
  readonly sourceType: SourceType;

  /** Throws AppError INVALID_SOURCE_INPUT, CREATOR_NOT_FOUND, SOURCE_RATE_LIMITED or SOURCE_TEMPORARILY_UNAVAILABLE. */
  resolveAccount(input: string): Promise<ResolvedSourceAccount>;
}

export type SourceAdapters = Record<SourceType, ContentSourceAdapter>;
