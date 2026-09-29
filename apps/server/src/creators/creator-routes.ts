import { type FollowedCreatorsResponse, ResolveCreatorRequestSchema } from "@finifeed/shared";
import { Hono } from "hono";
import type { Db } from "../database/database";
import type { AppEnv } from "../http/app-env";
import { parseJsonBody } from "../http/parse-json-body";
import type { SourceAdapters } from "../sources/content-source-adapter";
import { listFollowedCreators } from "../subscriptions/subscriptions";
import { resolveCreator } from "./resolve-creator";

export function creatorRoutes(db: Db, adapters: SourceAdapters) {
  return new Hono<AppEnv>()
    .get("/creators", async (c) => {
      const body: FollowedCreatorsResponse = { creators: await listFollowedCreators(db, c.get("userId")) };
      return c.json(body);
    })
    .post("/creators/resolve", async (c) => {
      const request = await parseJsonBody(c, ResolveCreatorRequestSchema);
      return c.json(await resolveCreator(db, adapters, c.get("userId"), request));
    });
}
