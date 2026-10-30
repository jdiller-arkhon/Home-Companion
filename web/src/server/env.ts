import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

/**
 * Runtime configuration. Everything has a safe local default so the app boots
 * on a fresh Raspberry Pi with zero configuration; secrets are generated on
 * first boot and persisted with 0600 permissions inside DATA_DIR.
 */
const DATA_DIR = path.resolve(process.env.HEARTH_DATA_DIR ?? path.join(process.cwd(), "data"));

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function persistentSecret(name: string, envVar: string): Buffer {
  const fromEnv = process.env[envVar];
  if (fromEnv) {
    const buf = Buffer.from(fromEnv, "base64");
    if (buf.length !== 32) throw new Error(`${envVar} must be 32 bytes, base64-encoded`);
    return buf;
  }
  ensureDir(path.join(DATA_DIR, "secrets"));
  const file = path.join(DATA_DIR, "secrets", name);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, crypto.randomBytes(32).toString("base64"), { mode: 0o600, flag: "wx" });
  }
  return Buffer.from(fs.readFileSync(file, "utf8").trim(), "base64");
}

let cached: ReturnType<typeof load> | null = null;

function load() {
  ensureDir(DATA_DIR);
  return {
    dataDir: DATA_DIR,
    dbPath: path.join(DATA_DIR, "hearth.db"),
    vaultDir: path.join(DATA_DIR, "vault"),
    backupDir: path.resolve(process.env.HEARTH_BACKUP_DIR ?? path.join(DATA_DIR, "backups")),
    masterKey: persistentSecret("master.key", "HEARTH_MASTER_KEY"),
    serviceToken: process.env.HEARTH_SERVICE_TOKEN ?? persistentSecret("service.token", "HEARTH_SERVICE_TOKEN_B64").toString("hex"),
    brainUrl: process.env.HEARTH_BRAIN_URL ?? "http://127.0.0.1:8100",
    secureCookies: process.env.HEARTH_SECURE_COOKIES !== "false" && process.env.NODE_ENV === "production",
    disableScheduler: process.env.HEARTH_DISABLE_SCHEDULER === "true",
  };
}

export function env() {
  if (!cached) cached = load();
  return cached;
}
