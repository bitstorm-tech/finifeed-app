import type { CreatorCandidate, ResolveCreatorRequest } from "@finifeed/shared";
import type { Db } from "../database/database";
import type { SourceAdapters } from "../sources/content-source-adapter";
import { upsertSourceAccount } from "./upsert-source-account";

/**
 * Resolves user input to a creator candidate (spec §11.2, §13.3). The creator and its source account are
 * stored (they are shared, not user-specific), but the user does not follow it until they confirm.
 */
export async function resolveCreator(
  db: Db,
  adapters: SourceAdapters,
  userId: string,
  request: ResolveCreatorRequest,
): Promise<CreatorCandidate> {
  const account = await adapters[request.sourceType].resolveAccount(request.input);
  const stored = await upsertSourceAccount(db, account);

  const subscription = await db
    .selectFrom("user_subscriptions")
    .select("id")
    .where("user_id", "=", userId)
    .where("creator_id", "=", stored.creatorId)
    .where("active", "=", true)
    .executeTakeFirst();

  return {
    creatorId: stored.creatorId,
    displayName: account.displayName,
    avatarUrl: account.avatarUrl,
    source: {
      id: stored.id,
      sourceType: account.sourceType,
      handle: account.handle,
      displayName: account.displayName,
      canonicalUrl: account.canonicalUrl,
    },
    subscriptionId: subscription?.id ?? null,
  };
}
