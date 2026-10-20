import { describe, expect, test } from "bun:test";
import { loadConfig } from "./config";

describe("loadConfig", () => {
  const DATABASE_URL = "postgres://finifeed:finifeed@localhost:5432/finifeed";

  test("uses defaults in development", () => {
    const config = loadConfig({ DATABASE_URL });

    expect(config).toEqual({
      appEnv: "development",
      port: 3000,
      databaseUrl: DATABASE_URL,
      logLevel: "info",
      logFormat: "text",
      youtubeApiKey: undefined,
    });
  });

  test("requires DATABASE_URL", () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL is required/);
    expect(() => loadConfig({ APP_ENV: "production" })).toThrow(/DATABASE_URL is required/);
  });

  test("requires YOUTUBE_API_KEY in production", () => {
    expect(() =>
      loadConfig({ APP_ENV: "production", DATABASE_URL: "postgresql://user:pw@db.internal:5432/finifeed" }),
    ).toThrow(/YOUTUBE_API_KEY is required/);
  });

  test("accepts explicit production configuration", () => {
    const config = loadConfig({
      APP_ENV: "production",
      PORT: "8080",
      DATABASE_URL: "postgresql://user:pw@db.internal:5432/finifeed",
      YOUTUBE_API_KEY: "test-key",
    });

    expect(config.port).toBe(8080);
    expect(config.databaseUrl).toBe("postgresql://user:pw@db.internal:5432/finifeed");
    expect(config.youtubeApiKey).toBe("test-key");
    expect(config.logFormat).toBe("json");
  });

  test("lets LOG_FORMAT override the default", () => {
    expect(loadConfig({ DATABASE_URL, LOG_FORMAT: "json" }).logFormat).toBe("json");
    expect(() => loadConfig({ DATABASE_URL, LOG_FORMAT: "xml" })).toThrow(/Invalid configuration/);
  });

  test("rejects invalid values", () => {
    expect(() => loadConfig({ PORT: "not-a-port" })).toThrow(/Invalid configuration/);
    expect(() => loadConfig({ DATABASE_URL: "mysql://localhost/db" })).toThrow(/Invalid configuration/);
    expect(() => loadConfig({ APP_ENV: "staging" })).toThrow(/Invalid configuration/);
  });
});
