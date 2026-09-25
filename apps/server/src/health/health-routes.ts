import { Hono } from "hono";
import type { Db } from "../database/database";
import type { AppEnv } from "../http/app-env";
import { checkHealth } from "./check-health";

export function healthRoutes(db: Db) {
  return new Hono<AppEnv>().get("/health", async (c) => {
    const health = await checkHealth(db, c.get("logger"));
    return c.json(health, health.status === "ok" ? 200 : 503);
  });
}
