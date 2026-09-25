import { Hono } from "hono";
import { requestId } from "hono/request-id";
import type { Logger } from "pino";
import type { Db } from "./database/database";
import { healthRoutes } from "./health/health-routes";
import type { AppEnv } from "./http/app-env";
import { handleError, handleNotFound } from "./http/errors";
import { requestLogging } from "./http/request-logging";

export interface AppDependencies {
  db: Db;
  logger: Logger;
}

/** Builds the HTTP application without binding a port, so tests can call `app.request()` directly. */
export function createApp({ db, logger }: AppDependencies) {
  const api = new Hono<AppEnv>().route("/", healthRoutes(db));

  return new Hono<AppEnv>()
    .use(requestId())
    .use(requestLogging(logger))
    .route("/api/v1", api)
    .notFound(handleNotFound)
    .onError(handleError);
}
