import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { ErrorResponseSchema, HealthResponseSchema } from "@finifeed/shared";
import { createApp } from "../app";
import { connectDatabase } from "../database/database";
import { migrate } from "../database/migrate";
import type { SourceAdapters } from "../sources/content-source-adapter";
import { createTestDatabase, silentLogger, type TestDatabase } from "../testing/test-database";

let database: TestDatabase;

const unusedDependencies = {
  sourceAdapters: {} as SourceAdapters,
  devUserId: crypto.randomUUID(),
};

beforeAll(async () => {
  database = await createTestDatabase();
  await migrate(database.sql, silentLogger);
}, 120_000);

afterAll(async () => {
  await database?.drop();
});

describe("GET /api/v1/health", () => {
  test("returns 200 when the database is reachable", async () => {
    const app = createApp({ db: database.db, logger: silentLogger, ...unusedDependencies });

    const response = await app.request("/api/v1/health");

    expect(response.status).toBe(200);
    expect(HealthResponseSchema.parse(await response.json())).toEqual({ status: "ok", database: "ok" });
    expect(response.headers.get("X-Request-Id")).toBeTruthy();
  });

  test("returns 503 when the database is unreachable", async () => {
    // Port 1 is never a PostgreSQL server; the connection fails immediately.
    const unreachable = connectDatabase("postgres://nobody:nothing@127.0.0.1:1/none");
    const app = createApp({ db: unreachable.db, logger: silentLogger, ...unusedDependencies });

    try {
      const response = await app.request("/api/v1/health");

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ status: "degraded", database: "unavailable" });
    } finally {
      await unreachable.close();
    }
  });

  test("unknown routes return a structured 404", async () => {
    const app = createApp({ db: database.db, logger: silentLogger, ...unusedDependencies });

    const response = await app.request("/api/v1/does-not-exist");

    expect(response.status).toBe(404);
    const body = ErrorResponseSchema.parse(await response.json());
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.requestId).toBeString();
    expect(response.headers.get("X-Request-Id")).toBe(body.error.requestId ?? "missing");
  });
});
