/**
 * Time helpers. Date-only values are stored as UTC midnight of the calendar
 * date (timezone-independent); date-times are real instants interpreted in the
 * household time zone.
 */
export const DAY = 86_400_000;

export function parseDateOnly(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new Error(`Invalid date: ${s}`);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}

export function formatDateOnlyInput(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Offset (ms) of `tz` from UTC at instant `ms`. */
export function tzOffset(ms: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (t: string) => +parts.find((p) => p.type === t)!.value;
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** "2026-10-29T18:30" wall time in `tz` → epoch ms. */
export function parseLocalDateTime(s: string, tz: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s);
  if (!m) throw new Error(`Invalid date-time: ${s}`);
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let guess = wall - tzOffset(wall, tz);
  guess = wall - tzOffset(guess, tz); // second pass handles DST boundaries
  return guess;
}

export function formatLocalDateTimeInput(ms: number, tz: string): string {
  return new Date(ms + tzOffset(ms, tz)).toISOString().slice(0, 16);
}

/** Calendar date (UTC-midnight ms) of "today" in the household time zone. */
export function todayIn(tz: string, now = Date.now()): number {
  const local = new Date(now + tzOffset(now, tz));
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
}

export function addRecurrence(ms: number, rec: string): number {
  const d = new Date(ms);
  switch (rec) {
    case "weekly": return ms + 7 * DAY;
    case "biweekly": return ms + 14 * DAY;
    case "monthly": return addMonths(d, 1);
    case "quarterly": return addMonths(d, 3);
    case "yearly": return addMonths(d, 12);
    default: return ms;
  }
}

function addMonths(d: Date, n: number): number {
  const day = d.getUTCDate();
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, d.getUTCHours(), d.getUTCMinutes()));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(day, last)); // Jan 31 → Feb 28, not Mar 3
  return t.getTime();
}

export function formatMoney(cents: number | null | undefined, currency = "USD"): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function parseMoney(s: string): number {
  const clean = s.replace(/[^0-9.\-]/g, "");
  if (!clean || isNaN(+clean)) throw new Error(`Invalid amount: ${s}`);
  return Math.round(parseFloat(clean) * 100);
}

export function relativeDay(dateMs: number, todayMs: number): string {
  const diff = Math.round((dateMs - todayMs) / DAY);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  if (diff < -1 && diff > -30) return `${-diff} days ago`;
  return new Date(dateMs).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
