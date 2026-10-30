import { listItems, type Item } from "./items/repo";
import { getSettings } from "./settings";
import { externalOccurrences } from "./calendar";
import { DAY, todayIn } from "@/lib/time";
import { getWeather, describeWeather } from "./integrations/weather";
import { haConfigured, listDevices, type Device } from "./integrations/homeassistant";

/**
 * Deterministic household snapshot. Powers the dashboard, the morning/evening
 * briefing and the assistant's context — works with no AI model at all.
 */
export async function snapshot(viewerId: string) {
  const s = getSettings();
  const today = todayIn(s.timezone);
  const horizon = today + 8 * DAY;
  const open = ["open", "active", "scheduled", "ordered", "in_transit", "out_for_delivery", "issue"];
  const upcoming = listItems(viewerId, { status: open, dueBefore: horizon });

  const by = (k: string | string[]) => upcoming.filter((i) => (Array.isArray(k) ? k : [k]).includes(i.kind));
  const overdue = upcoming.filter((i) => i.due_at! < today && ["task", "chore", "maintenance", "errand"].includes(i.kind));

  // Occasions recur yearly: project this year's date.
  const occasions = listItems(viewerId, { kind: "occasion" }).map((o) => {
    const d = new Date(o.due_at!);
    let next = Date.UTC(new Date(today).getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    if (next < today) next = Date.UTC(new Date(today).getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate());
    return { ...o, due_at: next };
  }).filter((o) => o.due_at - today <= Math.max(14, Number(o.data.remind_days ?? 0)) * DAY).sort((a, b) => a.due_at - b.due_at);

  const lowStock = listItems(viewerId, { kind: "consumable" }).filter((c) => c.data.reorder_at != null && Number(c.data.stock) <= Number(c.data.reorder_at));
  const packages = listItems(viewerId, { kind: "package", status: ["ordered", "in_transit", "out_for_delivery", "issue"] });
  const warranties = listItems(viewerId, { kind: "appliance", status: "in_service", dueAfter: today, dueBefore: today + 60 * DAY });

  let devices: Device[] | null = null;
  let homeError: string | null = null;
  if (haConfigured()) {
    try { devices = await listDevices(); } catch (e) { homeError = e instanceof Error ? e.message : String(e); }
  }
  const weather = await getWeather();

  return {
    today, tz: s.timezone, household: s.household_name,
    events: [...by("event").filter((e) => e.due_at! >= today), ...externalOccurrences(viewerId, today, horizon)].sort((a, b) => a.due_at! - b.due_at!),
    tasks: by(["task", "chore", "errand"]),
    maintenance: by(["maintenance", "vehicle"]),
    overdue, occasions, lowStock, packages, warranties,
    groceries: listItems(viewerId, { kind: "grocery", status: "open" }),
    home: devices ? summarizeHome(devices) : null, homeError,
    weather,
  };
}

export type Snapshot = Awaited<ReturnType<typeof snapshot>>;

export function summarizeHome(devices: Device[]) {
  const lightsOn = devices.filter((d) => d.domain === "light" && d.state === "on");
  const unlocked = devices.filter((d) => d.domain === "lock" && d.state === "unlocked");
  const open = devices.filter((d) => (d.domain === "binary_sensor" && ["door", "window", "garage_door", "opening"].includes(d.deviceClass ?? "") && d.state === "on") || (d.domain === "cover" && d.deviceClass === "garage" && d.state === "open"));
  const offline = devices.filter((d) => !d.available && !["scene", "script", "automation", "person"].includes(d.domain));
  const climate = devices.filter((d) => d.domain === "climate");
  const lowBattery = devices.filter((d) => d.domain === "sensor" && d.deviceClass === "battery" && Number(d.state) <= 20);
  return { total: devices.length, lightsOn, unlocked, open, offline, climate, lowBattery };
}

function when(i: Item, today: number) {
  const d = Math.round((i.due_at! - today) / DAY);
  return d < 0 ? `${-d}d overdue` : d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`;
}

/** Plain-language briefing lines (also fed to the model as grounded context). */
export function briefingLines(s: Snapshot, mode: "morning" | "evening" = "morning"): string[] {
  const lines: string[] = [];
  const dayEnd = s.today + DAY;
  if (!("unavailable" in s.weather)) {
    const w = s.weather;
    const t = w.daily[0];
    lines.push(`${describeWeather(w.current.code)}, ${Math.round(w.current.temp)}${w.unit} now; high ${Math.round(t.max)}${w.unit}, low ${Math.round(t.min)}${w.unit}${t.precip >= 40 ? `, ${t.precip}% chance of rain — bring an umbrella` : ""}.`);
  }
  const todays = s.events.filter((e) => e.due_at! < dayEnd);
  if (mode === "evening") {
    const tomorrow = s.events.filter((e) => e.due_at! >= dayEnd && e.due_at! < dayEnd + DAY);
    lines.push(tomorrow.length ? `Tomorrow: ${tomorrow.map((e) => e.title).join(", ")}.` : "Nothing on the calendar tomorrow.");
  } else {
    lines.push(todays.length ? `${todays.length} event${todays.length > 1 ? "s" : ""} today: ${todays.map((e) => e.title).join(", ")}.` : "Your calendar is clear today.");
  }
  if (s.overdue.length) lines.push(`Overdue: ${s.overdue.map((i) => i.title).join(", ")}.`);
  const dueTasks = s.tasks.filter((t) => t.due_at! < dayEnd && t.due_at! >= s.today);
  if (dueTasks.length) lines.push(`Due today: ${dueTasks.map((t) => t.title).join(", ")}.`);
  const arriving = s.packages.filter((p) => p.due_at != null && p.due_at < dayEnd + DAY);
  if (arriving.length) lines.push(`Arriving soon: ${arriving.map((p) => p.title).join(", ")}.`);
  if (s.occasions.length) lines.push(`Coming up: ${s.occasions.slice(0, 3).map((o) => `${o.title} (${String(o.data.type ?? "").toLowerCase() || "occasion"}) ${when(o, s.today)}`).join("; ")}.`);
  if (s.maintenance.length) lines.push(`Home upkeep: ${s.maintenance.slice(0, 3).map((m) => `${m.title} ${when(m, s.today)}`).join("; ")}.`);
  if (s.lowStock.length) lines.push(`Running low: ${s.lowStock.map((c) => c.title).join(", ")}.`);
  if (s.home) {
    const h = s.home;
    const issues = [
      h.unlocked.length && `${h.unlocked.map((d) => d.name).join(", ")} unlocked`,
      h.open.length && `${h.open.map((d) => d.name).join(", ")} open`,
      h.offline.length && `${h.offline.length} device${h.offline.length > 1 ? "s" : ""} offline`,
      h.lowBattery.length && `low battery: ${h.lowBattery.map((d) => d.name).join(", ")}`,
    ].filter(Boolean);
    lines.push(issues.length ? `Home: ${issues.join("; ")}.` : `Home is secure — all ${h.total} devices reporting normally.`);
  }
  return lines;
}
