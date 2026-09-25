import type { HealthResponse } from "@finifeed/shared";
import { sql } from "kysely";
import type { Logger } from "pino";
import type { Db } from "../database/database";

export async function checkHealth(db: Db, logger: Logger): Promise<HealthResponse> {
  try {
    await sql`select 1`.execute(db);
    return { status: "ok", database: "ok" };
  } catch (error) {
    logger.warn({ err: error }, "health check: database unavailable");
    return { status: "degraded", database: "unavailable" };
  }
}
