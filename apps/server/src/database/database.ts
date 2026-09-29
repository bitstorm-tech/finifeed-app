import type { SourceType } from "@finifeed/shared";
import { type ColumnType, type Generated, Kysely } from "kysely";
import { PostgresJSDialect } from "kysely-postgres-js";
import postgres from "postgres";

/** Timestamp columns with a database default: optional on insert, a Date when read. */
type CreatedTimestamp = ColumnType<Date, Date | string | undefined, Date | string>;

export interface UsersTable {
  id: Generated<string>;
  email: string;
  created_at: CreatedTimestamp;
  updated_at: CreatedTimestamp;
}

export interface CreatorsTable {
  id: Generated<string>;
  display_name: string;
  avatar_url: string | null;
  created_at: CreatedTimestamp;
  updated_at: CreatedTimestamp;
}

export type SyncStatus = "PENDING" | "OK" | "FAILED";

export interface SourceAccountsTable {
  id: Generated<string>;
  creator_id: string;
  source_type: SourceType;
  external_id: string;
  handle: string | null;
  display_name: string;
  canonical_url: string;
  avatar_url: string | null;
  /** Adapter-specific data, e.g. `{ uploadsPlaylistId }` for YouTube. */
  source_metadata: ColumnType<Record<string, unknown>, Record<string, unknown> | undefined, Record<string, unknown>>;
  last_synced_at: Date | null;
  sync_status: ColumnType<SyncStatus, SyncStatus | undefined, SyncStatus>;
  created_at: CreatedTimestamp;
  updated_at: CreatedTimestamp;
}

export interface UserSubscriptionsTable {
  id: Generated<string>;
  user_id: string;
  creator_id: string;
  priority: ColumnType<"HIGH" | "NORMAL" | "LOW", "HIGH" | "NORMAL" | "LOW" | undefined>;
  followed_at: CreatedTimestamp;
  inbox_from: ColumnType<Date, Date | string, Date | string>;
  active: ColumnType<boolean, boolean | undefined, boolean>;
}

/** Kysely table typings. Must match the SQL migrations. */
export interface DatabaseSchema {
  users: UsersTable;
  creators: CreatorsTable;
  source_accounts: SourceAccountsTable;
  user_subscriptions: UserSubscriptionsTable;
}

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
