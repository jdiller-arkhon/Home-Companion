import { db } from "./db/client";
import { decryptString, encryptString } from "./crypto";

/** Household-level settings. Keys ending in `_secret` are encrypted at rest. */
export type HouseholdSettings = {
  household_name: string;
  timezone: string;
  currency: string;
  latitude: number | null;
  longitude: number | null;
  location_label: string;
  temperature_unit: "fahrenheit" | "celsius";
  onboarded: boolean;
  ha_url: string;
  ai_endpoint: string;          // Ollama-compatible base URL
  ai_model: string;
  ai_remote_endpoint: string;   // optional stronger GPU machine
  ai_prefer_remote: boolean;
  kiosk_idle_minutes: number;
  backup_retention: number;
  morning_briefing_hour: number;
  evening_recap: boolean;
  assistant_name: string;
  assistant_voice: string;
  kiosk_motion_entity: string;
};

const DEFAULTS: HouseholdSettings = {
  household_name: "Our Home",
  timezone: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  currency: "USD",
  latitude: null,
  longitude: null,
  location_label: "",
  temperature_unit: "fahrenheit",
  onboarded: false,
  ha_url: process.env.HEARTH_HA_URL ?? "",
  ai_endpoint: process.env.HEARTH_OLLAMA_URL ?? "http://127.0.0.1:11434",
  ai_model: process.env.HEARTH_AI_MODEL ?? "qwen2.5:3b",
  ai_remote_endpoint: "",
  ai_prefer_remote: false,
  kiosk_idle_minutes: 0,
  backup_retention: 14,
  morning_briefing_hour: 7,
  evening_recap: false,
  assistant_name: "Hearth",
  assistant_voice: "kokoro:af_heart",
  kiosk_motion_entity: "",
};

export function getSettings(): HouseholdSettings {
  const rows = db().prepare("SELECT key, value FROM settings WHERE key NOT LIKE '%_secret'").all() as { key: string; value: string }[];
  const out: Record<string, unknown> = { ...DEFAULTS };
  for (const r of rows) if (r.key in DEFAULTS) out[r.key] = JSON.parse(r.value);
  return out as HouseholdSettings;
}

export function updateSettings(patch: Partial<HouseholdSettings>) {
  const stmt = db().prepare("INSERT INTO settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at");
  db().transaction(() => {
    for (const [k, v] of Object.entries(patch)) {
      if (!(k in DEFAULTS) || v === undefined) continue;
      stmt.run(k, JSON.stringify(v), Date.now());
    }
  })();
}

export function setSecret(name: string, value: string | null) {
  const key = `${name}_secret`;
  if (value === null) db().prepare("DELETE FROM settings WHERE key = ?").run(key);
  else db().prepare("INSERT INTO settings (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at")
    .run(key, JSON.stringify(encryptString(value)), Date.now());
}

export function getSecret(name: string): string | null {
  const r = db().prepare("SELECT value FROM settings WHERE key = ?").get(`${name}_secret`) as { value: string } | undefined;
  return r ? decryptString(JSON.parse(r.value)) : null;
}

export function hasSecret(name: string): boolean {
  return !!db().prepare("SELECT 1 FROM settings WHERE key = ?").get(`${name}_secret`);
}
