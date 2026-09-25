import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { sql } from "kysely";
import { createTestDatabase, type TestDatabase } from "../testing/test-database";
import { connectDatabase, type DatabaseConnection } from "./database";

let database: TestDatabase;

/** postgres.js queries are lazy thenables; an async wrapper turns them into a real Promise that actually runs. */
const selectOne = async (connection: DatabaseConnection) => connection.sql`select 1`;

beforeAll(async () => {
  database = await createTestDatabase();
}, 120_000);

afterAll(async () => {
  await database?.drop();
});

describe("connectDatabase().close", () => {
  // Regression: an open pool keeps the process alive, e.g. `bun run migrate` never exits.
  test("ends the pool when only the raw client was used", async () => {
    const connection = connectDatabase(database.url);
    await connection.sql`select 1`;

    await connection.close();

    await expect(selectOne(connection)).rejects.toMatchObject({ code: "CONNECTION_ENDED" });
  });

  test("ends the pool when Kysely was used", async () => {
    const connection = connectDatabase(database.url);
    await sql`select 1`.execute(connection.db);

    await connection.close();

    await expect(selectOne(connection)).rejects.toMatchObject({ code: "CONNECTION_ENDED" });
  });
});
