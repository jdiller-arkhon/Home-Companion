/**
 * Minimal RFC 5545 support: writing a feed for Apple/Google Calendar, and
 * reading subscribed feeds (iCloud public/shared, Google "secret address").
 * Recurrence expansion covers DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL,
 * COUNT, UNTIL and BYDAY (weekly) — what consumer calendars actually emit.
 */
export type IcsEvent = { uid: string; title: string; start: number; end?: number; allDay: boolean; location?: string; description?: string; rrule?: string;
  /** For TZID events: local wall-clock start and zone, so recurrences follow local days/DST. */ wall?: number; tz?: string };

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const utc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const dateOnly = (ms: number) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");

function fold(line: string): string {
  const out: string[] = [];
  let s = line;
  while (Buffer.byteLength(s) > 74) {
    let n = 74;
    while (Buffer.byteLength(s.slice(0, n)) > 74) n--;
    out.push(s.slice(0, n));
    s = " " + s.slice(n);
  }
  out.push(s);
  return out.join("\r\n");
}

export function writeCalendar(name: string, events: IcsEvent[]): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Hearth//Household//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`, "X-PUBLISHED-TTL:PT30M", "REFRESH-INTERVAL;VALUE=DURATION:PT30M"];
  const stamp = utc(Date.now());
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}@hearth`, `DTSTAMP:${stamp}`, `SUMMARY:${esc(e.title)}`);
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(e.start)}`, `DTEND;VALUE=DATE:${dateOnly((e.end ?? e.start) + 86_400_000)}`);
    } else {
      lines.push(`DTSTART:${utc(e.start)}`, `DTEND:${utc(e.end ?? e.start + 3_600_000)}`);
    }
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.rrule) lines.push(`RRULE:${e.rrule}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

const unesc = (s: string) => s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");

/** Parses DTSTART-style values. TZID'd local times are interpreted via `toUtc`. */
function parseDate(value: string, params: string, toUtc: (wall: number, tz: string) => number): { ms: number; allDay: boolean; wall?: number; tz?: string } {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) throw new Error(`bad date ${value}`);
  if (!m[4]) return { ms: Date.UTC(+m[1], +m[2] - 1, +m[3]), allDay: true };
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  if (m[7]) return { ms: wall, allDay: false };
  const tz = /TZID=([^;:]+)/.exec(params)?.[1];
  return tz ? { ms: toUtc(wall, tz), allDay: false, wall, tz } : { ms: wall, allDay: false };
}

export function parseCalendar(text: string, toUtc: (wall: number, tz: string) => number): IcsEvent[] {
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const events: IcsEvent[] = [];
  let cur: Record<string, { params: string; value: string }> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { cur = {}; continue; }
    if (line === "END:VEVENT" && cur) {
      try {
        if (cur.DTSTART && !cur["RECURRENCE-ID"] && (cur.STATUS?.value ?? "") !== "CANCELLED") {
          const s = parseDate(cur.DTSTART.value, cur.DTSTART.params, toUtc);
          const e = cur.DTEND ? parseDate(cur.DTEND.value, cur.DTEND.params, toUtc) : null;
          events.push({ uid: cur.UID?.value ?? `${s.ms}`, title: unesc(cur.SUMMARY?.value ?? "(busy)").slice(0, 200), start: s.ms,
            end: e ? (s.allDay ? e.ms - 86_400_000 : e.ms) : undefined, allDay: s.allDay, location: cur.LOCATION ? unesc(cur.LOCATION.value).slice(0, 200) : undefined, rrule: cur.RRULE?.value, wall: s.wall, tz: s.tz });
        }
      } catch { /* skip malformed events */ }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const head = line.slice(0, i);
    const [name, ...params] = head.split(";");
    cur[name.toUpperCase()] = { params: params.join(";"), value: line.slice(i + 1) };
  }
  return events;
}

const DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** Expands recurring events into concrete occurrences inside [from, to). */
export function expand(events: IcsEvent[], from: number, to: number, toUtc: (wall: number, tz: string) => number = (w) => w, cap = 500): IcsEvent[] {
  const out: IcsEvent[] = [];
  for (const ev of events) {
    // Recur in local wall time (so "Mondays 6 PM" stays Monday 6 PM across DST), then convert.
    const conv = ev.tz ? (w: number) => toUtc(w, ev.tz!) : (w: number) => w;
    const e = ev.tz && ev.wall != null ? { ...ev, start: ev.wall, end: ev.end != null ? ev.wall + (ev.end - ev.start) : undefined } : ev;
    const dur = (e.end ?? e.start) - e.start;
    if (!e.rrule) { if (ev.start < to && (ev.end ?? ev.start) >= from) out.push(ev); continue; }
    const r = Object.fromEntries(e.rrule.split(";").map((kv) => kv.split("=")));
    const freq = r.FREQ, interval = Math.max(1, +(r.INTERVAL ?? 1));
    const count = r.COUNT ? +r.COUNT : Infinity;
    const until = r.UNTIL ? parseDate(r.UNTIL, "", (w) => w).ms : Infinity;
    const byday = r.BYDAY ? (r.BYDAY as string).split(",").map((d) => DAYS.indexOf(d.slice(-2))).filter((d) => d >= 0) : null;
    let n = 0;
    const push = (wallMs: number) => {
      n++;
      const ms = conv(wallMs);
      if (ms >= from && ms < to) out.push({ ...ev, uid: `${e.uid}:${ms}`, start: ms, end: e.end != null ? conv(wallMs + dur) : undefined, rrule: undefined, wall: undefined, tz: undefined });
    };
    const base = new Date(e.start);
    for (let k = 0; n < count && n < cap * 4; k++) {
      let ms: number;
      if (freq === "DAILY") ms = e.start + k * interval * 86_400_000;
      else if (freq === "WEEKLY") {
        const weekStart = e.start + k * interval * 7 * 86_400_000 - base.getUTCDay() * 86_400_000;
        const days = byday?.length ? byday : [base.getUTCDay()];
        if (weekStart > until || weekStart > to) break;
        for (const d of days.sort()) {
          const occ = weekStart + d * 86_400_000;
          if (occ < e.start || occ > until || n >= count) continue;
          push(occ);
        }
        continue;
      } else if (freq === "MONTHLY") ms = Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + k * interval, base.getUTCDate(), base.getUTCHours(), base.getUTCMinutes());
      else if (freq === "YEARLY") ms = Date.UTC(base.getUTCFullYear() + k * interval, base.getUTCMonth(), base.getUTCDate(), base.getUTCHours(), base.getUTCMinutes());
      else break;
      if (ms > until || ms > to) break;
      push(ms);
    }
  }
  return out.sort((a, b) => a.start - b.start).slice(0, cap);
}
