import pino, { type Logger } from "pino";
import pretty from "pino-pretty";
import type { Config } from "../config/config";

/** Structured JSON logs to stdout (spec §19), or readable single-line text via pino-pretty for local work. */
export function createLogger(config: Pick<Config, "logLevel" | "logFormat" | "appEnv">): Logger {
  const options = {
    level: config.logLevel,
    base: { service: "finifeed-server", env: config.appEnv },
  };
  if (config.logFormat === "json") return pino(options);

  // Used as a synchronous stream, not a worker-thread transport, so fatal logs are written before process.exit.
  return pino(
    options,
    pretty({
      sync: true,
      singleLine: true,
      translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
      ignore: "pid,hostname,service,env,requestId",
      messageFormat: "{if requestId}[{requestId}] {end}{msg}",
    }),
  );
}
