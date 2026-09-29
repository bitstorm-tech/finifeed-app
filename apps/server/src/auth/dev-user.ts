import { createMiddleware } from "hono/factory";
import type { Db } from "../database/database";
import type { AppEnv } from "../http/app-env";

export const DEV_USER_EMAIL = "dev@finifeed.local";

/** Creates the single development user if needed and returns its ID (spec §16, step 1). */
export async function ensureDevUser(db: Db): Promise<string> {
  const user = await db
    .insertInto("users")
    .values({ email: DEV_USER_EMAIL })
    .onConflict((oc) => oc.column("email").doUpdateSet({ email: DEV_USER_EMAIL }))
    .returning("id")
    .executeTakeFirstOrThrow();
  return user.id;
}

/** Local auth bypass: every request acts as the given user. Replaced by magic-link sessions in Slice 5. */
export function devAuth(userId: string) {
  return createMiddleware<AppEnv>(async (c, next) => {
    c.set("userId", userId);
    await next();
  });
}
