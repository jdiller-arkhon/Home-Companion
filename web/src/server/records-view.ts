import "server-only";
import { listItems, toFormValues, type Item, type ListOptions } from "./items/repo";
import { kindDef } from "./items/kinds";
import { getSettings } from "./settings";
import { listUsers, getUser } from "./users";
import { trackingUrl } from "@/lib/tracking";
import { formatMoney, relativeDay, todayIn, DAY } from "@/lib/time";
import type { RecordRow, Person } from "@/components/records";

/** Converts records into display rows for the client board. */
export function toRows(viewerId: string, items: Item[]): RecordRow[] {
  const s = getSettings();
  const today = todayIn(s.timezone);
  return items.map((i) => {
    const def = kindDef(i.kind);
    const open = def.doneStatus ? i.status !== def.doneStatus : true;
    const days = i.due_at != null ? Math.floor((i.due_at - today) / DAY) : null;
    const isDatetime = def.fields.find((f) => f.promote === "due_at")?.type === "datetime";
    let dueLabel: string | null = null;
    if (i.due_at != null) {
      dueLabel = isDatetime
        ? new Date(i.due_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: s.timezone })
        : `${def.dueLabel ? def.dueLabel + " " : ""}${(() => { const r = relativeDay(i.due_at, today); return def.dueLabel && /^(Today|Tomorrow|Yesterday|In )/.test(r) ? r[0].toLowerCase() + r.slice(1) : r; })()}`;
    }
    const meta: string[] = [];
    for (const k of ["assignee", "carrier", "tracking", "location", "brand", "model", "aisle", "quantity", "slot", "asset", "vendor", "type", "merchant"]) {
      if (i.data[k] && !(k === "aisle" && i.kind === "grocery")) meta.push(String(i.data[k]));
    }
    if (i.kind === "consumable") meta.push(`${i.data.stock ?? 0} in stock`);
    if (i.kind === "goal" && i.data.progress != null) meta.push(`${i.data.progress}%`);
    const rec = String(i.data.recurrence ?? "none");
    return {
      id: i.id, kind: i.kind, title: i.title, status: i.status, visibility: i.visibility, mine: i.owner_id === viewerId,
      dueLabel, dueTone: open && days != null && !isDatetime ? (days < 0 ? "bad" : days <= 3 ? "warn" : "neutral") : "neutral",
      amount: i.amount_cents != null ? formatMoney(i.amount_cents, s.currency) : null, meta,
      recurring: rec !== "none" && rec !== "", url: i.kind === "package" ? trackingUrl(i.data.carrier as string | undefined, i.data.tracking as string | undefined) : typeof i.data.url === "string" ? i.data.url : typeof i.data.manual_url === "string" ? i.data.manual_url : null,
      form: toFormValues(i, s.timezone),
      group: i.kind === "grocery" ? String(i.data.aisle ?? "Other") : undefined,
      doneBy: def.doneStatus && i.status === def.doneStatus ? doneByName(i) : undefined,
    };
  });
}

const names = new Map<string, string>();
function doneByName(i: Item): string | undefined {
  const by = (i.data.history as { by?: string }[] | undefined)?.[0]?.by;
  if (!by) return undefined;
  if (!names.has(by)) names.set(by, getUser(by)?.name ?? "");
  return names.get(by) || undefined;
}

const AISLE_ORDER = ["Produce", "Bakery", "Dairy", "Meat & Fish", "Pantry", "Frozen", "Household", "Other"];

export function rowsFor(viewerId: string, kind: string, opts: ListOptions = {}) {
  let items = listItems(viewerId, { kind, ...opts });
  if (kind === "grocery") {
    // Show the open list plus things checked off in the last 12 hours, grouped by store section.
    const cutoff = Date.now() - 12 * 3_600_000;
    items = items.filter((i) => i.status === "open" || i.updated_at > cutoff)
      .sort((a, b) => AISLE_ORDER.indexOf(String(a.data.aisle ?? "Other")) - AISLE_ORDER.indexOf(String(b.data.aisle ?? "Other")) || (a.status === "open" ? -1 : 1) - (b.status === "open" ? -1 : 1));
  }
  return toRows(viewerId, items);
}

export function people(): Person[] {
  return listUsers().map((u) => ({ id: u.id, name: u.name }));
}
