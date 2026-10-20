import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { createTestDatabase, silentLogger, type TestDatabase } from "../testing/test-database";
import { MIGRATIONS_DIR, migrate } from "./migrate";

let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
}, 120_000);

afterAll(async () => {
  await database?.drop();
});

async function withMigrationsDir(files: Record<string, string>, run: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "finifeed-migrations-"));
  try {
    for (const [name, content] of Object.entries(files)) {
      await Bun.write(join(dir, name), content);
    }
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("migrate", () => {
  test("applies the repository migrations and is idempotent", async () => {
    const first = await migrate(database.sql, silentLogger, MIGRATIONS_DIR);
    expect(first).toContain("0001_baseline.sql");

    const second = await migrate(database.sql, silentLogger, MIGRATIONS_DIR);
    expect(second).toEqual([]);

    const [user] = await database.sql`insert into users (email) values ('uuid@example.com') returning uuid_extract_version(id) as version`;
    expect(user?.version).toBe(7);

    const tables = await database.sql`
      select table_schema, table_name from information_schema.tables
      where table_schema in ('public', 'finifeed') order by table_name
    `;
    expect(tables.map((row) => `${row.table_schema}.${row.table_name}`)).toEqual([
      "finifeed.creators",
      "finifeed.schema_migrations",
      "finifeed.source_accounts",
      "finifeed.user_subscriptions",
      "finifeed.users",
    ]);
  });

  test("moves a database migrated before the finifeed schema out of public", async () => {
    const scratch = await createTestDatabase();
    // Plain connection with the default search_path, as the server used before the dedicated schema.
    const legacy = postgres(scratch.url, { max: 1, onnotice: () => {} });
    try {
      await legacy`create table schema_migrations (filename text primary key, checksum text not null, applied_at timestamptz not null default now())`;
      for (const filename of ["0001_baseline.sql", "0002_creators_and_subscriptions.sql"]) {
        const content = await Bun.file(join(MIGRATIONS_DIR, filename)).text();
        await legacy.unsafe(content);
        const checksum = new Bun.CryptoHasher("sha256").update(content).digest("hex");
        await legacy`insert into schema_migrations (filename, checksum) values (${filename}, ${checksum})`;
      }
      await legacy`insert into users (email) values ('legacy@example.com')`;

      expect(await migrate(scratch.sql, silentLogger)).toEqual(["0003_uuidv7_primary_keys.sql", "0004_finifeed_schema.sql"]);

      const [moved] = await scratch.sql`select email from finifeed.users`;
      expect(moved?.email).toBe("legacy@example.com");
      const [user] = await scratch.sql`insert into users (email) values ('new@example.com') returning uuid_extract_version(id) as version`;
      expect(user?.version).toBe(7);
      const leftovers = await scratch.sql`select table_name from information_schema.tables where table_schema = 'public'`;
      expect(leftovers).toHaveLength(0);
    } finally {
      await legacy.end();
      await scratch.drop();
    }
  });

  test("applies pending files in filename order", async () => {
    await withMigrationsDir(
      {
        "0002_second.sql": "insert into ordering_probe values ('second');",
        "0001_first.sql": "create table ordering_probe (step text not null);",
      },
      async (dir) => {
        const scratch = await createTestDatabase();
        try {
          expect(await migrate(scratch.sql, silentLogger, dir)).toEqual(["0001_first.sql", "0002_second.sql"]);
          const rows = await scratch.sql`select step from ordering_probe`;
          expect(rows.map((row) => row.step)).toEqual(["second"]);
        } finally {
          await scratch.drop();
        }
      },
    );
  });

  test("rolls back a failing migration completely", async () => {
    await withMigrationsDir(
      { "0001_broken.sql": "create table half_done (id int); select * from does_not_exist;" },
      async (dir) => {
        const scratch = await createTestDatabase();
        try {
          await expect(migrate(scratch.sql, silentLogger, dir)).rejects.toThrow(/does_not_exist/);
          const [table] = await scratch.sql`select to_regclass('half_done') as oid`;
          expect(table?.oid).toBeNull();
          const applied = await scratch.sql`select filename from schema_migrations`;
          expect(applied).toHaveLength(0);
        } finally {
          await scratch.drop();
        }
      },
    );
  });

  test("refuses to run when an applied migration was modified", async () => {
    const scratch = await createTestDatabase();
    try {
      await withMigrationsDir({ "0001_create.sql": "create table edited (id int);" }, async (dir) => {
        await migrate(scratch.sql, silentLogger, dir);
      });
      await withMigrationsDir({ "0001_create.sql": "create table edited (id bigint);" }, async (dir) => {
        await expect(migrate(scratch.sql, silentLogger, dir)).rejects.toThrow(/was modified after it was applied/);
      });
    } finally {
      await scratch.drop();
    }
  });

  test("rejects files that do not follow the naming convention", async () => {
    await withMigrationsDir({ "create_users.sql": "select 1;" }, async (dir) => {
      await expect(migrate(database.sql, silentLogger, dir)).rejects.toThrow(/Invalid migration filename/);
    });
  });
});
