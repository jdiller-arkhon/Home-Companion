import fs from "node:fs";
import path from "node:path";
import { env } from "./env";
import { db } from "./db/client";
import { decryptBuffer, encryptBuffer } from "./crypto";

/** Floor-plan image (encrypted at rest — it reveals the home's layout) plus device pin positions in %. */
export type Pin = { x: number; y: number };
export type Plan = { hasImage: boolean; pins: Record<string, Pin>; version: number };

const file = () => path.join(env().vaultDir, "floorplan.bin");

export function getFloorPlan(): Plan {
  const r = db().prepare("SELECT value, updated_at FROM settings WHERE key='floorplan_pins'").get() as { value: string; updated_at: number } | undefined;
  return { hasImage: fs.existsSync(file()), pins: r ? JSON.parse(r.value) : {}, version: r?.updated_at ?? 0 };
}

export function saveFloorImage(bytes: Buffer, mime: string) {
  if (!/^image\/(png|jpeg|webp)$/.test(mime)) throw new Error("Use a PNG, JPEG or WebP image.");
  if (bytes.length > 8 * 1024 * 1024) throw new Error("Image must be under 8 MB.");
  fs.mkdirSync(env().vaultDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(file(), encryptBuffer(Buffer.concat([Buffer.from(mime.padEnd(16)), bytes]), "vault"), { mode: 0o600 });
}

export function readFloorImage(): { mime: string; bytes: Buffer } | null {
  if (!fs.existsSync(file())) return null;
  const b = decryptBuffer(fs.readFileSync(file()), "vault");
  return { mime: b.subarray(0, 16).toString().trim(), bytes: b.subarray(16) };
}

export function savePins(pins: Record<string, Pin>) {
  const clean: Record<string, Pin> = {};
  for (const [id, p] of Object.entries(pins)) {
    if (!/^[a-z_]+\.[a-z0-9_]+$/.test(id)) continue;
    clean[id] = { x: Math.max(0, Math.min(100, +p.x)), y: Math.max(0, Math.min(100, +p.y)) };
  }
  db().prepare("INSERT INTO settings (key,value,updated_at) VALUES ('floorplan_pins',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at").run(JSON.stringify(clean), Date.now());
}
