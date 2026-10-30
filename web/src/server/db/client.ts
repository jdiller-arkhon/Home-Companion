import Database from "better-sqlite3";
import { env } from "../env";
import { migrations } from "./migrations";

declare global {
  // eslint-disable-next-line no-var
  var __hearthDb: Database.Database | undefined;
}

export function openDatabase(file: string): Database.Database {
  const db = new Database(file);
  db.pragma("journal_mode = WAL"); // concurrent readers, crash-safe on SD/SSD
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  return db;
}

export function migrate(db: Database.Database) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT, applied_at INTEGER)");
  const applied = new Set(
    (db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[]).map((r) => r.version),
  );
  for (const m of migrations) {
    if (applied.has(m.version)) continue;
    db.transaction(() => {
      db.exec(m.sql);
      db.prepare("INSERT INTO schema_migrations VALUES (?,?,?)").run(m.version, m.name, Date.now());
    })();
  }
}

/** Process-wide singleton (survives Next.js dev hot reloads). */
export function db(): Database.Database {
  if (!globalThis.__hearthDb) globalThis.__hearthDb = openDatabase(env().dbPath);
  return globalThis.__hearthDb;
}

/** Test hook: swap the singleton for an in-memory database. */
export function useDatabaseForTests(instance: Database.Database) {
  globalThis.__hearthDb = instance;
}
