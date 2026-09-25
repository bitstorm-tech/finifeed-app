import { Kysely } from "kysely";
import { PostgresJSDialect } from "kysely-postgres-js";
import postgres from "postgres";

/** Kysely table typings. Filled in as feature migrations are added. */
export interface DatabaseSchema {}

export type Db = Kysely<DatabaseSchema>;

export interface DatabaseConnection {
  /** Raw postgres.js client, used by the migration runner. */
  sql: postgres.Sql;
  db: Db;
  close(): Promise<void>;
}

export function connectDatabase(databaseUrl: string): DatabaseConnection {
  const sql = postgres(databaseUrl, {
    max: 10,
    connect_timeout: 5,
    onnotice: () => {},
  });
  const db = new Kysely<DatabaseSchema>({ dialect: new PostgresJSDialect({ postgres: sql }) });

  return {
    sql,
    db,
    async close() {
      await db.destroy();
      // Kysely initializes its driver lazily; if only the raw client was used, destroy() leaves the pool open.
      await sql.end();
    },
  };
}
