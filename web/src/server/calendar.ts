import { db } from "./db/client";
import { newId } from "./ids";
import { decryptString, encryptString } from "./crypto";
import { listItems, type Item } from "./items/repo";
import { getSettings } from "./settings";
import { log } from "./log";
import { expand, parseCalendar, writeCalendar, type IcsEvent } from "@/lib/ical";
import { parseLocalDateTime, DAY } from "@/lib/time";

const toUtc = (wall: number, tz: string) => {
  try { return parseLocalDateTime(new Date(wall).toISOString().slice(0, 16), tz); } catch { return wall; }
};

const RRULE: Record<string, string> = { weekly: "FREQ=WEEKLY", biweekly: "FREQ=WEEKLY;INTERVAL=2", monthly: "FREQ=MONTHLY", quarterly: "FREQ=MONTHLY;INTERVAL=3", yearly: "FREQ=YEARLY" };

/** Everything dated that this person can see, as an iCal feed their phone subscribes to. */
export function feedFor(userId: string, name: string): string {
  const open = ["open", "active", "scheduled", "ordered", "in_transit", "out_for_delivery", "planned"];
  const items = listItems(userId, { kind: ["event", "task", "chore", "errand", "maintenance", "occasion", "meal", "package"], status: open, limit: 5000 })
    .filter((i) => i.due_at != null);
  const events: IcsEvent[] = items.map((i) => {
    const rec = String(i.data.recurrence ?? "none");
    if (i.kind === "event") {
      return { uid: i.id, title: i.title, start: i.due_at!, end: typeof i.data.ends_at === "number" ? i.data.ends_at : undefined, allDay: false,
        location: i.data.location as string | undefined, description: i.data.notes as string | undefined, rrule: RRULE[rec] };
    }
    const prefix = { task: "☐ ", chore: "☐ ", errand: "☐ ", maintenance: "🔧 ", occasion: "", meal: "🍽 ", package: "📦 " }[i.kind] ?? "";
    return { uid: i.id, title: prefix + i.title + (i.kind === "occasion" && i.data.type ? ` (${i.data.type})` : ""), start: i.due_at!, allDay: true,
      rrule: i.kind === "occasion" ? "FREQ=YEARLY" : undefined, description: i.data.notes as string | undefined };
  });
  return writeCalendar(name, events);
}

// ── Subscribed calendars (iCloud / Google / school / work) ───────────────
export type ExternalCal = { id: string; user_id: string; name: string; shared: boolean; last_sync: number | null; last_error: string | null; count: number };
type Row = { id: string; user_id: string; name: string; url_enc: string; shared: number; last_sync: number | null; last_error: string | null; events: string };

export function listExternal(userId: string): ExternalCal[] {
  return (db().prepare("SELECT * FROM external_calendars WHERE user_id=? OR shared=1 ORDER BY name").all(userId) as Row[])
    .map((r) => ({ id: r.id, user_id: r.user_id, name: r.name, shared: !!r.shared, last_sync: r.last_sync, last_error: r.last_error, count: JSON.parse(r.events).length }));
}

export function addExternal(userId: string, name: string, url: string, shared: boolean) {
  const u = new URL(url.trim().replace(/^webcal:/i, "https:"));
  if (u.protocol !== "https:") throw new Error("Use the https:// or webcal:// address of the calendar.");
  const id = newId();
  db().prepare("INSERT INTO external_calendars (id,user_id,name,url_enc,shared,created_at) VALUES (?,?,?,?,?,?)")
    .run(id, userId, name.trim().slice(0, 60) || u.hostname, encryptString(u.toString()), shared ? 1 : 0, Date.now());
  return id;
}

export function removeExternal(userId: string, id: string) {
  db().prepare("DELETE FROM external_calendars WHERE id=? AND user_id=?").run(id, userId);
}

export async function syncExternal(id?: string) {
  const rows = (id ? db().prepare("SELECT * FROM external_calendars WHERE id=?").all(id) : db().prepare("SELECT * FROM external_calendars").all()) as Row[];
  for (const r of rows) {
    try {
      const res = await fetch(decryptString(r.url_enc), { signal: AbortSignal.timeout(15_000), headers: { Accept: "text/calendar" }, redirect: "follow", cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.length > 5_000_000 || !text.includes("BEGIN:VCALENDAR")) throw new Error("That address didn't return a calendar.");
      const events = parseCalendar(text, toUtc).filter((e) => e.rrule || e.start > Date.now() - 400 * DAY);
      db().prepare("UPDATE external_calendars SET events=?, last_sync=?, last_error=NULL WHERE id=?").run(JSON.stringify(events), Date.now(), r.id);
    } catch (e) {
      log.warn("calendar.sync_failed", { id: r.id, error: String(e) });
      db().prepare("UPDATE external_calendars SET last_error=?, last_sync=? WHERE id=?").run(String((e as Error).message ?? e).slice(0, 200), Date.now(), r.id);
    }
  }
}

/** External occurrences in a window, shaped like items so every view can show them. */
export function externalOccurrences(userId: string, from: number, to: number): Item[] {
  const rows = db().prepare("SELECT id, name, events FROM external_calendars WHERE user_id=? OR shared=1").all(userId) as { id: string; name: string; events: string }[];
  const tz = getSettings().timezone;
  return rows.flatMap((r) => expand(JSON.parse(r.events) as IcsEvent[], from, to, (w, z) => toUtc(w, z || tz)).map((e) => ({
    id: `ext:${r.id}:${e.uid}`, kind: e.allDay ? "external_allday" : "external", owner_id: userId, visibility: "shared" as const, title: e.title, status: "scheduled",
    due_at: e.start, amount_cents: null, parent_id: null, data: { calendar: r.name, location: e.location, ends_at: e.end }, position: 0, created_at: 0, updated_at: 0,
  })));
}
