import { ErrorCode, type FollowedCreator } from "@finifeed/shared";
import { sql } from "kysely";
import { jsonArrayFrom } from "kysely/helpers/postgres";
import type { Db } from "../database/database";
import { AppError } from "../errors/app-error";

/** How far back content is eligible for the inbox when a creator is (re-)followed (spec §8.4). */
const INITIAL_BACKLOG = sql<Date>`now() - interval '7 days'`;

/**
 * Follows a creator. Idempotent: following an already followed creator returns the existing subscription.
 * Re-following after an unfollow reactivates the subscription with a fresh backlog window.
 */
export async function followCreator(
  db: Db,
  userId: string,
  creatorId: string,
): Promise<{ subscription: FollowedCreator; created: boolean }> {
  const creator = await db.selectFrom("creators").select("id").where("id", "=", creatorId).executeTakeFirst();
  if (!creator) throw new AppError(ErrorCode.CREATOR_NOT_FOUND, "Creator not found.");

  const inserted = await db
    .insertInto("user_subscriptions")
    .values({ user_id: userId, creator_id: creatorId, inbox_from: INITIAL_BACKLOG })
    .onConflict((oc) =>
      oc
        .columns(["user_id", "creator_id"])
        .doUpdateSet({ active: true, followed_at: sql`now()`, inbox_from: INITIAL_BACKLOG })
        .where("user_subscriptions.active", "=", false),
    )
    .returning("id")
    .executeTakeFirst();

  const subscription = await findFollowedCreator(db, userId, creatorId);
  if (!subscription) throw new Error(`Subscription for creator ${creatorId} vanished after follow`);
  return { subscription, created: inserted !== undefined };
}

/** Unfollows. The row is kept inactive so content states survive a later re-follow. */
export async function unfollow(db: Db, userId: string, subscriptionId: string): Promise<void> {
  const result = await db
    .updateTable("user_subscriptions")
    .set({ active: false })
    .where("id", "=", subscriptionId)
    .where("user_id", "=", userId)
    .where("active", "=", true)
    .executeTakeFirst();
  if (result.numUpdatedRows === 0n) throw new AppError(ErrorCode.NOT_FOUND, "Subscription not found.");
}

/** Creators the user actively follows, alphabetically by name. */
export async function listFollowedCreators(db: Db, userId: string): Promise<FollowedCreator[]> {
  const rows = await followedCreatorsQuery(db, userId).execute();
  return rows.map(toFollowedCreator);
}

async function findFollowedCreator(db: Db, userId: string, creatorId: string): Promise<FollowedCreator | undefined> {
  const row = await followedCreatorsQuery(db, userId).where("c.id", "=", creatorId).executeTakeFirst();
  return row && toFollowedCreator(row);
}

function toFollowedCreator({ followedAt, ...row }: FollowedCreatorRow): FollowedCreator {
  return { ...row, followedAt: followedAt.toISOString() };
}

type FollowedCreatorRow = Awaited<ReturnType<ReturnType<typeof followedCreatorsQuery>["executeTakeFirstOrThrow"]>>;

function followedCreatorsQuery(db: Db, userId: string) {
  return db
    .selectFrom("user_subscriptions as s")
    .innerJoin("creators as c", "c.id", "s.creator_id")
    .where("s.user_id", "=", userId)
    .where("s.active", "=", true)
    .select((eb) => [
      "s.id as subscriptionId",
      "c.id as creatorId",
      "c.display_name as displayName",
      "c.avatar_url as avatarUrl",
      "s.followed_at as followedAt",
      jsonArrayFrom(
        eb
          .selectFrom("source_accounts as sa")
          .whereRef("sa.creator_id", "=", "c.id")
          .select([
            "sa.id",
            "sa.source_type as sourceType",
            "sa.handle",
            "sa.display_name as displayName",
            "sa.canonical_url as canonicalUrl",
          ])
          .orderBy("sa.source_type")
          .orderBy("sa.created_at"),
      ).as("sources"),
    ])
    .orderBy(sql`lower(c.display_name)`)
    .orderBy("c.id");
}
