import { z } from "zod";

/** Matches the database from docker-compose.yml. Never used in production. */
const LOCAL_DATABASE_URL = "postgres://finifeed:finifeed@localhost:5433/finifeed";

const EnvSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }).optional(),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  YOUTUBE_API_KEY: z.string().trim().min(1).optional(),
});

export type AppEnv = z.infer<typeof EnvSchema>["APP_ENV"];

export interface Config {
  appEnv: AppEnv;
  port: number;
  databaseUrl: string;
  logLevel: z.infer<typeof EnvSchema>["LOG_LEVEL"];
  /** YouTube Data API key. Optional in development; creator resolution fails without it. */
  youtubeApiKey: string | undefined;
}

/** Parses and validates configuration. Throws with all problems listed if the environment is invalid. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid configuration:\n${z.prettifyError(parsed.error)}`);
  }
  const { APP_ENV, PORT, DATABASE_URL, LOG_LEVEL, YOUTUBE_API_KEY } = parsed.data;

  if (APP_ENV === "production" && !DATABASE_URL) {
    throw new Error("Invalid configuration: DATABASE_URL is required in production");
  }
  if (APP_ENV === "production" && !YOUTUBE_API_KEY) {
    throw new Error("Invalid configuration: YOUTUBE_API_KEY is required in production");
  }

  return {
    appEnv: APP_ENV,
    port: PORT,
    databaseUrl: DATABASE_URL ?? LOCAL_DATABASE_URL,
    logLevel: LOG_LEVEL,
    youtubeApiKey: YOUTUBE_API_KEY,
  };
}
