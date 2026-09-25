import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import pino from "pino";
import postgres from "postgres";
import { connectDatabase, type DatabaseConnection } from "../database/database";

export const silentLogger = pino({ level: "silent" });

/**
 * One PostgreSQL container per `bun test` process (all test files share the process).
 * Testcontainers' reaper removes it when the process exits.
 */
let container: Promise<StartedPostgreSqlContainer> | undefined;

function sharedContainer() {
  container ??= new PostgreSqlContainer("postgres:17-alpine").start();
  return container;
}

export interface TestDatabase extends DatabaseConnection {
  url: string;
  /** Closes connections and drops the database. */
  drop(): Promise<void>;
}

/** Creates an isolated, empty database for one test file. Migrations are not applied. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const adminUrl = (await sharedContainer()).getConnectionUri();
  const name = `test_${crypto.randomUUID().replaceAll("-", "")}`;

  const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${name}`);
  await admin.end();

  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  const connection = connectDatabase(url.toString());

  return {
    ...connection,
    url: url.toString(),
    async drop() {
      await connection.close();
      const cleanup = postgres(adminUrl, { max: 1, onnotice: () => {} });
      await cleanup.unsafe(`drop database if exists ${name} with (force)`);
      await cleanup.end();
    },
  };
}
