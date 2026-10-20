import { TakeoutImportRequestSchema, TakeoutPreviewRequestSchema } from "@finifeed/shared";
import { Hono } from "hono";
import type { Db } from "../database/database";
import type { AppEnv } from "../http/app-env";
import { parseJsonBody } from "../http/parse-json-body";
import type { SourceAdapters } from "../sources/content-source-adapter";
import { importTakeoutChannels, previewTakeout } from "./youtube-takeout";

export function integrationRoutes(db: Db, adapters: SourceAdapters) {
  return new Hono<AppEnv>()
    .post("/integrations/youtube/takeout/preview", async (c) => {
      const { csv } = await parseJsonBody(c, TakeoutPreviewRequestSchema);
      return c.json(await previewTakeout(db, c.get("userId"), csv));
    })
    .post("/integrations/youtube/takeout/import", async (c) => {
      const { channelIds } = await parseJsonBody(c, TakeoutImportRequestSchema);
      return c.json(await importTakeoutChannels(db, adapters, c.get("userId"), channelIds));
    });
}
