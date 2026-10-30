import { getSecret, getSettings } from "../settings";
import { log } from "../log";

/**
 * Home Assistant REST client. HA is the local automation backend; Hearth owns
 * the interface and the safety policy. Nothing here bypasses `policy.ts` —
 * callers decide whether an action needs confirmation first.
 */
export type HAState = {
  entity_id: string; state: string; last_changed: string; last_updated: string;
  attributes: Record<string, unknown> & { friendly_name?: string; unit_of_measurement?: string; device_class?: string };
};

export type Device = {
  id: string; domain: string; name: string; state: string; area: string | null; unit?: string; deviceClass?: string;
  available: boolean; lastChanged: string; attributes: Record<string, unknown>;
};

export const SUPPORTED_DOMAINS = ["light", "switch", "lock", "climate", "sensor", "binary_sensor", "cover", "fan", "scene", "script", "automation", "media_player", "alarm_control_panel", "person", "vacuum"] as const;

export class HAUnavailable extends Error {}

function config() {
  const { ha_url } = getSettings();
  const token = getSecret("ha_token");
  if (!ha_url || !token) throw new HAUnavailable("Home Assistant is not connected. Add its address and a long-lived token in Settings → Integrations.");
  return { base: ha_url.replace(/\/$/, ""), token };
}

export function haConfigured(): boolean {
  try { config(); return true; } catch { return false; }
}

async function ha<T>(path: string, init: RequestInit = {}, timeoutMs = 6000): Promise<T> {
  const { base, token } = config();
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (e) {
    log.warn("ha.unreachable", { path, error: String(e) });
    throw new HAUnavailable("Home Assistant is not reachable on the network right now.");
  }
  if (res.status === 401) throw new HAUnavailable("Home Assistant rejected the access token. Create a new long-lived token.");
  if (!res.ok) throw new Error(`Home Assistant error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export async function ping(): Promise<{ ok: boolean; message: string; version?: string }> {
  try {
    const r = await ha<{ message: string }>("/api/");
    const cfg = await ha<{ version: string; location_name: string }>("/api/config");
    return { ok: true, message: `${cfg.location_name} · ${r.message}`, version: cfg.version };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** Area membership via HA's template engine (REST has no area registry API). */
async function areaMap(): Promise<Record<string, string>> {
  const template = "{% set ns = namespace(out={}) %}{% for a in areas() %}{% for e in area_entities(a) %}{% set ns.out = dict(ns.out, **{e: area_name(a)}) %}{% endfor %}{% endfor %}{{ ns.out | tojson }}";
  try {
    const raw = await ha<string>("/api/template", { method: "POST", body: JSON.stringify({ template }) });
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (e) {
    log.warn("ha.areas_failed", { error: String(e) });
    return {};
  }
}

export async function listDevices(): Promise<Device[]> {
  const [states, areas] = await Promise.all([ha<HAState[]>("/api/states"), areaMap()]);
  return states
    .filter((s) => (SUPPORTED_DOMAINS as readonly string[]).includes(s.entity_id.split(".")[0]))
    .map((s) => ({
      id: s.entity_id,
      domain: s.entity_id.split(".")[0],
      name: s.attributes.friendly_name ?? s.entity_id,
      state: s.state,
      area: areas[s.entity_id] ?? null,
      unit: s.attributes.unit_of_measurement,
      deviceClass: s.attributes.device_class,
      available: s.state !== "unavailable" && s.state !== "unknown",
      lastChanged: s.last_changed,
      attributes: s.attributes,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getDevice(entityId: string): Promise<Device | null> {
  return (await listDevices()).find((d) => d.id === entityId) ?? null;
}

const ENTITY_RE = /^[a-z_]+\.[a-z0-9_]+$/;

export async function callService(domain: string, service: string, data: Record<string, unknown>) {
  if (!/^[a-z_]+$/.test(domain) || !/^[a-z_]+$/.test(service)) throw new Error("Invalid service");
  if (data.entity_id && !ENTITY_RE.test(String(data.entity_id))) throw new Error("Invalid entity");
  return ha<HAState[]>(`/api/services/${domain}/${service}`, { method: "POST", body: JSON.stringify(data) }, 10_000);
}

export async function history(entityId: string, hours = 24): Promise<{ state: string; last_changed: string }[]> {
  if (!ENTITY_RE.test(entityId)) throw new Error("Invalid entity");
  const start = new Date(Date.now() - hours * 3_600_000).toISOString();
  const r = await ha<{ state: string; last_changed: string }[][]>(`/api/history/period/${start}?filter_entity_id=${entityId}&minimal_response&no_attributes`);
  return r[0] ?? [];
}
