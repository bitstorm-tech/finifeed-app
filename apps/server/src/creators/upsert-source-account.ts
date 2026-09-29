import { sql } from "kysely";
import type { Db } from "../database/database";
import type { ResolvedSourceAccount } from "../sources/content-source-adapter";

export interface UpsertedSourceAccount {
  id: string;
  creatorId: string;
}

/**
 * Stores a resolved source account, creating its Creator on first sight. Re-resolving refreshes the
 * account's metadata and, while each creator has exactly one source (MVP), the creator's name and avatar.
 * Concurrent calls for the same external account are serialized, so exactly one row per account exists.
 */
export async function upsertSourceAccount(db: Db, account: ResolvedSourceAccount): Promise<UpsertedSourceAccount> {
  return db.transaction().execute(async (tx) => {
    await sql`select pg_advisory_xact_lock(hashtext(${`source_account:${account.sourceType}:${account.externalId}`}))`.execute(tx);

    const fields = {
      handle: account.handle,
      display_name: account.displayName,
      canonical_url: account.canonicalUrl,
      avatar_url: account.avatarUrl,
      // postgres.js serializes objects for jsonb parameters; a pre-stringified value would be stored as a JSON string.
      source_metadata: account.metadata,
    };

    const existing = await tx
      .selectFrom("source_accounts")
      .select(["id", "creator_id as creatorId"])
      .where("source_type", "=", account.sourceType)
      .where("external_id", "=", account.externalId)
      .executeTakeFirst();

    if (existing) {
      await tx
        .updateTable("source_accounts")
        .set({ ...fields, updated_at: sql`now()` })
        .where("id", "=", existing.id)
        .execute();
      await tx
        .updateTable("creators")
        .set({ display_name: account.displayName, avatar_url: account.avatarUrl, updated_at: sql`now()` })
        .where("id", "=", existing.creatorId)
        .execute();
      return existing;
    }

    const creator = await tx
      .insertInto("creators")
      .values({ display_name: account.displayName, avatar_url: account.avatarUrl })
      .returning("id")
      .executeTakeFirstOrThrow();
    return tx
      .insertInto("source_accounts")
      .values({ ...fields, creator_id: creator.id, source_type: account.sourceType, external_id: account.externalId })
      .returning(["id", "creator_id as creatorId"])
      .executeTakeFirstOrThrow();
  });
}
