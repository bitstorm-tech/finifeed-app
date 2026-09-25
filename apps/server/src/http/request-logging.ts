import { createMiddleware } from "hono/factory";
import type { Logger } from "pino";
import type { AppEnv } from "./app-env";

/** Binds a per-request child logger and logs one line per completed request. Requires the requestId middleware. */
export function requestLogging(logger: Logger) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const requestLogger = logger.child({ requestId: c.get("requestId") });
    c.set("logger", requestLogger);

    const startedAt = performance.now();
    await next();

    requestLogger.info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Math.round(performance.now() - startedAt),
      },
      "request completed",
    );
  });
}
