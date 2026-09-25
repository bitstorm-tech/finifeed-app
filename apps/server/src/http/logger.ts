import pino, { type Logger } from "pino";
import type { Config } from "../config/config";

/** Structured JSON logs to stdout (spec §19). */
export function createLogger(config: Pick<Config, "logLevel" | "appEnv">): Logger {
  return pino({
    level: config.logLevel,
    base: { service: "finifeed-server", env: config.appEnv },
  });
}
