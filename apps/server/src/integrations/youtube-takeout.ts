import type { TakeoutImportResponse, TakeoutPreviewResponse } from "@finifeed/shared";
import { upsertSourceAccount } from "../creators/upsert-source-account";
import type { Db } from "../database/database";
import type { SourceAdapters } from "../sources/content-source-adapter";
import { parseTakeoutSubscriptions } from "../sources/youtube/parse-takeout-subscriptions";
import { followCreators, listFollowedCreators } from "../subscriptions/subscriptions";

/**
 * Lists the channels of a Takeout `subscriptions.csv` and marks those the user already follows.
 * Stores nothing and does not call YouTube, so even a large export costs no quota until the user picks.
 */
export async function previewTakeout(db: Db, userId: string, csv: string): Promise<TakeoutPreviewResponse> {
  const subscriptions = parseTakeoutSubscriptions(csv);

  const followed = await db
    .selectFrom("source_accounts as sa")
    .innerJoin("user_subscriptions as s", "s.creator_id", "sa.creator_id")
    .where("sa.source_type", "=", "YOUTUBE")
    .where("sa.external_id", "in", subscriptions.map((subscription) => subscription.channelId))
    .where("s.user_id", "=", userId)
    .where("s.active", "=", true)
    .select(["sa.external_id as channelId", "s.id as subscriptionId"])
    .execute();
  const subscriptionIds = new Map(followed.map((row) => [row.channelId, row.subscriptionId]));

  const channels = subscriptions
    .map(({ channelId, title }) => ({
      channelId,
      title,
      canonicalUrl: `https://www.youtube.com/channel/${channelId}`,
      subscriptionId: subscriptionIds.get(channelId) ?? null,
    }))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  return { channels };
}

/**
 * Follows the channels the user picked from a Takeout preview. Channel details come from YouTube, not
 * from the file, which may be outdated. Idempotent: already followed channels are only counted.
 */
export async function importTakeoutChannels(
  db: Db,
  adapters: SourceAdapters,
  userId: string,
  channelIds: string[],
): Promise<TakeoutImportResponse> {
  const requested = [...new Set(channelIds)];
  const accounts = await adapters.YOUTUBE.resolveAccountsByExternalId(requested);

  const creatorIds: string[] = [];
  for (const account of accounts) creatorIds.push((await upsertSourceAccount(db, account)).creatorId);
  const newlyFollowed = await followCreators(db, userId, creatorIds);

  const found = new Set(accounts.map((account) => account.externalId));
  return {
    followed: await listFollowedCreators(db, userId, { creatorIds: newlyFollowed }),
    alreadyFollowingCount: creatorIds.length - newlyFollowed.length,
    notFoundChannelIds: requested.filter((id) => !found.has(id)),
  };
}
