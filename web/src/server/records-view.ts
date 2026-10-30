import "server-only";
import { listItems, toFormValues, type Item, type ListOptions } from "./items/repo";
import { kindDef } from "./items/kinds";
import { getSettings } from "./settings";
import { listUsers } from "./users";
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
        : `${def.dueLabel ? def.dueLabel + " " : ""}${relativeDay(i.due_at, today).replace(/^(\w)/, (c) => (def.dueLabel ? c.toLowerCase() : c))}`;
    }
    const meta: string[] = [];
    for (const k of ["category", "assignee", "carrier", "tracking", "location", "brand", "model", "aisle", "quantity", "slot", "asset", "vendor", "type", "merchant"]) {
      if (i.data[k]) meta.push(String(i.data[k]));
    }
    if (i.kind === "consumable") meta.push(`${i.data.stock ?? 0} in stock`);
    if (i.kind === "savings_goal") meta.push(`${formatMoney(Number(i.data.saved ?? 0), s.currency)} saved`);
    if (i.kind === "goal" && i.data.progress != null) meta.push(`${i.data.progress}%`);
    if (i.data.autopay) meta.push("Autopay");
    const rec = String(i.data.recurrence ?? "none");
    return {
      id: i.id, kind: i.kind, title: i.title, status: i.status, visibility: i.visibility, mine: i.owner_id === viewerId,
      dueLabel, dueTone: open && days != null && !isDatetime ? (days < 0 ? "bad" : days <= 3 ? "warn" : "neutral") : "neutral",
      amount: i.amount_cents != null ? formatMoney(i.amount_cents, s.currency) : null, meta,
      recurring: rec !== "none" && rec !== "", url: typeof i.data.url === "string" ? i.data.url : typeof i.data.manual_url === "string" ? i.data.manual_url : null,
      form: toFormValues(i, s.timezone),
    };
  });
}

export function rowsFor(viewerId: string, kind: string, opts: ListOptions = {}) {
  return toRows(viewerId, listItems(viewerId, { kind, ...opts }));
}

export function people(): Person[] {
  return listUsers().map((u) => ({ id: u.id, name: u.name }));
}
