import fs from "node:fs";
import path from "node:path";
import { db } from "./db/client";
import { env } from "./env";
import { getSettings } from "./settings";
import { log } from "./log";

/**
 * Consistent online backups: SQLite's backup API (safe while the app is
 * writing) plus a copy of the encrypted vault blobs. Backups stay encrypted —
 * restoring requires the same master key, so keep data/secrets/master.key
 * somewhere safe and separate (see docs/SECURITY.md).
 */
export type BackupInfo = { name: string; createdAt: number; sizeMb: number };

export async function runBackup(reason = "scheduled"): Promise<BackupInfo> {
  const { backupDir, vaultDir } = env();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(backupDir, `hearth-${stamp}`);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  await db().backup(path.join(dir, "hearth.db"));
  if (fs.existsSync(vaultDir)) fs.cpSync(vaultDir, path.join(dir, "vault"), { recursive: true });
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ createdAt: Date.now(), reason, schema: db().prepare("SELECT MAX(version) v FROM schema_migrations").get() }, null, 2));
  prune();
  log.info("backup.done", { dir, reason });
  return describe(dir);
}

function dirSize(p: string): number {
  return fs.readdirSync(p, { withFileTypes: true }).reduce((s, e) => {
    const f = path.join(p, e.name);
    return s + (e.isDirectory() ? dirSize(f) : fs.statSync(f).size);
  }, 0);
}

function describe(dir: string): BackupInfo {
  return { name: path.basename(dir), createdAt: fs.statSync(dir).mtimeMs, sizeMb: +(dirSize(dir) / 1e6).toFixed(2) };
}

export function listBackups(): BackupInfo[] {
  const { backupDir } = env();
  if (!fs.existsSync(backupDir)) return [];
  return fs.readdirSync(backupDir).filter((n) => n.startsWith("hearth-")).map((n) => describe(path.join(backupDir, n))).sort((a, b) => b.createdAt - a.createdAt);
}

export function lastBackup(): BackupInfo | null {
  return listBackups()[0] ?? null;
}

function prune() {
  const keep = Math.max(1, getSettings().backup_retention);
  for (const b of listBackups().slice(keep)) fs.rmSync(path.join(env().backupDir, b.name), { recursive: true, force: true });
}
