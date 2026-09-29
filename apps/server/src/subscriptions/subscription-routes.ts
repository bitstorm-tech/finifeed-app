import { ErrorCode, FollowCreatorRequestSchema } from "@finifeed/shared";
import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../database/database";
import { AppError } from "../errors/app-error";
import type { AppEnv } from "../http/app-env";
import { parseJsonBody } from "../http/parse-json-body";
import { followCreator, unfollow } from "./subscriptions";

export function subscriptionRoutes(db: Db) {
  return new Hono<AppEnv>()
    .post("/subscriptions", async (c) => {
      const { creatorId } = await parseJsonBody(c, FollowCreatorRequestSchema);
      const { subscription, created } = await followCreator(db, c.get("userId"), creatorId);
      return c.json(subscription, created ? 201 : 200);
    })
    .delete("/subscriptions/:subscriptionId", async (c) => {
      const subscriptionId = z.uuid().safeParse(c.req.param("subscriptionId"));
      if (!subscriptionId.success) throw new AppError(ErrorCode.NOT_FOUND, "Subscription not found.");
      await unfollow(db, c.get("userId"), subscriptionId.data);
      return c.body(null, 204);
    });
}
