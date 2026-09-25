import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
