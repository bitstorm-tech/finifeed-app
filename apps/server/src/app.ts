import { Hono } from "hono";
import { requestId } from "hono/request-id";
import type { Logger } from "pino";
import { devAuth } from "./auth/dev-user";
import { creatorRoutes } from "./creators/creator-routes";
import type { Db } from "./database/database";
import { healthRoutes } from "./health/health-routes";
import type { AppEnv } from "./http/app-env";
import { handleError, handleNotFound } from "./http/errors";
import { requestLogging } from "./http/request-logging";
import type { SourceAdapters } from "./sources/content-source-adapter";
import { subscriptionRoutes } from "./subscriptions/subscription-routes";

export interface AppDependencies {
  db: Db;
  logger: Logger;
  sourceAdapters: SourceAdapters;
  /** Every request acts as this user until real authentication exists (Slice 5). */
  devUserId: string;
}

/** Builds the HTTP application without binding a port, so tests can call `app.request()` directly. */
export function createApp({ db, logger, sourceAdapters, devUserId }: AppDependencies) {
  const api = new Hono<AppEnv>()
    .route("/", healthRoutes(db))
    .use(devAuth(devUserId))
    .route("/", creatorRoutes(db, sourceAdapters))
    .route("/", subscriptionRoutes(db));

  return new Hono<AppEnv>()
    .use(requestId())
    .use(requestLogging(logger))
    .route("/api/v1", api)
    .notFound(handleNotFound)
    .onError(handleError);
}
