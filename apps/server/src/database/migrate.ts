import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type postgres from "postgres";
import type { Logger } from "pino";

export const MIGRATIONS_DIR = join(import.meta.dir, "../../migrations");

const MIGRATION_FILE = /^\d{4}_[a-z0-9_]+\.sql$/;

/** Arbitrary constant key for pg_advisory_xact_lock so concurrent runners apply migrations one at a time. */
const MIGRATION_LOCK_KEY = 4_842_001;

interface AppliedMigration {
  filename: string;
  checksum: string;
}

/**
 * Applies pending `NNNN_description.sql` files in filename order, each in its own transaction.
 * An already-applied file whose content changed aborts the run: migrations are immutable.
 * Returns the filenames applied in this run.
 */
export async function migrate(sql: postgres.Sql, logger: Logger, dir = MIGRATIONS_DIR): Promise<string[]> {
  const files = await listMigrationFiles(dir);

  await sql`
    create table if not exists schema_migrations (
      filename text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `;

  const applied: string[] = [];
  for (const filename of files) {
    const content = await Bun.file(join(dir, filename)).text();
    const checksum = new Bun.CryptoHasher("sha256").update(content).digest("hex");

    const wasApplied = await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(${MIGRATION_LOCK_KEY})`;

      const [existing] = await tx<AppliedMigration[]>`
        select filename, checksum from schema_migrations where filename = ${filename}
      `;
      if (existing) {
        if (existing.checksum !== checksum) {
          throw new Error(`Migration ${filename} was modified after it was applied. Add a new migration instead.`);
        }
        return false;
      }

      await tx.unsafe(content);
      await tx`insert into schema_migrations (filename, checksum) values (${filename}, ${checksum})`;
      return true;
    });

    if (wasApplied) {
      logger.info({ migration: filename }, "migration applied");
      applied.push(filename);
    }
  }

  logger.info({ applied: applied.length, total: files.length }, "migrations up to date");
  return applied;
}

async function listMigrationFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  const sqlFiles = entries.filter((name) => name.endsWith(".sql"));
  const invalid = sqlFiles.filter((name) => !MIGRATION_FILE.test(name));
  if (invalid.length > 0) {
    throw new Error(`Invalid migration filename(s): ${invalid.join(", ")}. Expected NNNN_description.sql`);
  }
  return sqlFiles.sort();
}
