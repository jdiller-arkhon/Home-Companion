import { db } from "./db/client";
import { getSecret, setSecret } from "./settings";

/** The household's emergency card. The Wi-Fi password is stored encrypted, separately. */
export const EMERGENCY_FIELDS = [
  { name: "address", label: "Home address", group: "Home" },
  { name: "water_shutoff", label: "Water shut-off", group: "Home", placeholder: "Garage, left wall behind the bikes" },
  { name: "gas_shutoff", label: "Gas shut-off", group: "Home" },
  { name: "breaker", label: "Breaker panel", group: "Home" },
  { name: "alarm", label: "Alarm / lock instructions", group: "Home" },
  { name: "wifi_name", label: "Wi-Fi network", group: "Home" },
  { name: "contacts", label: "Emergency contacts", group: "People", multiline: true, placeholder: "Jordan — (555) 010-1234\nNeighbor Pat — (555) 010-5678" },
  { name: "doctor", label: "Doctor", group: "People" },
  { name: "vet", label: "Vet", group: "People" },
  { name: "plumber", label: "Plumber", group: "Services" },
  { name: "electrician", label: "Electrician", group: "Services" },
  { name: "hvac", label: "Heating & cooling", group: "Services" },
  { name: "insurance", label: "Home insurance (company & policy #)", group: "Services" },
  { name: "pets", label: "Pets & care notes", group: "Notes", multiline: true },
  { name: "notes", label: "Anything else", group: "Notes", multiline: true },
] as const;

export type Emergency = Record<string, string> & { wifi_password_set?: string };

export function getEmergency(): Record<string, string> {
  const r = db().prepare("SELECT value FROM settings WHERE key='emergency_card'").get() as { value: string } | undefined;
  return r ? JSON.parse(r.value) : {};
}

export function saveEmergency(values: Record<string, string>, wifiPassword?: string | null) {
  const clean: Record<string, string> = {};
  for (const f of EMERGENCY_FIELDS) { const v = (values[f.name] ?? "").trim().slice(0, 2000); if (v) clean[f.name] = v; }
  clean.share_wifi = values.share_wifi === "on" ? "on" : "";
  db().prepare("INSERT INTO settings (key,value,updated_at) VALUES ('emergency_card',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at").run(JSON.stringify(clean), Date.now());
  if (wifiPassword) setSecret("wifi_password", wifiPassword);
  if (wifiPassword === null) setSecret("wifi_password", null);
}

export function wifiPassword(): string | null { return getSecret("wifi_password"); }
