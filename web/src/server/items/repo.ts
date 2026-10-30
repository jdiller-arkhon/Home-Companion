import { db } from "../db/client";
import { newId } from "../ids";
import { getSettings } from "../settings";
import { addRecurrence, formatDateOnlyInput, formatLocalDateTimeInput, parseDateOnly, parseLocalDateTime, parseMoney } from "@/lib/time";
import { kindDef, type KindDef } from "./kinds";

export type Item = {
  id: string; kind: string; owner_id: string; visibility: "shared" | "private"; title: string; status: string;
  due_at: number | null; amount_cents: number | null; parent_id: string | null; data: Record<string, unknown>;
  position: number; created_at: number; updated_at: number;
};

type Row = Omit<Item, "data"> & { data: string };
const toItem = (r: Row): Item => ({ ...r, data: JSON.parse(r.data) });

export class ValidationError extends Error {
  constructor(public fieldErrors: Record<string, string>) {
    super(Object.values(fieldErrors)[0] ?? "Invalid input");
  }
}

/** Visibility predicate: shared items, or private items owned by the viewer. */
const VISIBLE = "(visibility = 'shared' OR owner_id = @viewer)";

export type ParsedInput = { title: string; due_at: number | null; amount_cents: number | null; data: Record<string, unknown> };

/** Converts raw string input (form posts / AI tool args) into a typed record. */
export function parseInput(kind: string, raw: Record<string, unknown>, tz = getSettings().timezone): ParsedInput {
  const def = kindDef(kind);
  const errors: Record<string, string> = {};
  const out: ParsedInput = { title: "", due_at: null, amount_cents: null, data: {} };

  for (const f of def.fields) {
    const v = raw[f.name];
    const str = v == null ? "" : String(v).trim();
    if (f.type === "bool") {
      out.data[f.name] = v === true || str === "on" || str === "true";
      continue;
    }
    if (!str) {
      if (f.required) errors[f.name] = `${f.label} is required`;
      continue;
    }
    let value: unknown = str;
    try {
      switch (f.type) {
        case "money": value = parseMoney(str); break;
        case "number": if (isNaN(+str)) throw new Error(`${f.label} must be a number`); value = +str; break;
        case "date": value = parseDateOnly(str.slice(0, 10)); break;
        case "datetime": value = str.length === 10 ? parseDateOnly(str) : parseLocalDateTime(str, tz); break;
        case "select": if (f.options && !f.options.includes(str)) throw new Error(`${f.label} must be one of: ${f.options.join(", ")}`); break;
        case "url": {
          const u = new URL(str);
          if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only http(s) links are allowed");
          break;
        }
        case "text": case "textarea": case "user":
          if (str.length > (f.type === "textarea" ? 20_000 : 300)) throw new Error(`${f.label} is too long`);
      }
    } catch (e) {
      errors[f.name] = e instanceof Error ? e.message : "Invalid value";
      continue;
    }
    if (f.promote === "title") out.title = value as string;
    else if (f.promote === "due_at") out.due_at = value as number;
    else if (f.promote === "amount_cents") out.amount_cents = value as number;
    else out.data[f.name] = value;
  }
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return out;
}

/** Inverse of parseInput — values suitable for pre-filling form inputs. */
export function toFormValues(item: Item, tz = getSettings().timezone): Record<string, string | boolean> {
  const def = kindDef(item.kind);
  const out: Record<string, string | boolean> = {};
  for (const f of def.fields) {
    const v = f.promote === "title" ? item.title : f.promote === "due_at" ? item.due_at : f.promote === "amount_cents" ? item.amount_cents : item.data[f.name];
    if (v == null) continue;
    if (f.type === "money") out[f.name] = ((v as number) / 100).toFixed(2);
    else if (f.type === "date") out[f.name] = formatDateOnlyInput(v as number);
    else if (f.type === "datetime") out[f.name] = formatLocalDateTimeInput(v as number, tz);
    else if (f.type === "bool") out[f.name] = !!v;
    else out[f.name] = String(v);
  }
  return out;
}

export type ListOptions = {
  kind?: string | string[];
  status?: string | string[];
  dueBefore?: number;
  dueAfter?: number;
  search?: string;
  limit?: number;
  order?: "due" | "recent" | "position";
};

export function listItems(viewerId: string, opts: ListOptions = {}): Item[] {
  const where = [VISIBLE];
  const params: Record<string, unknown> = { viewer: viewerId };
  const inList = (col: string, key: string, v: string | string[]) => {
    const arr = Array.isArray(v) ? v : [v];
    where.push(`${col} IN (${arr.map((_, i) => `@${key}${i}`).join(",")})`);
    arr.forEach((x, i) => (params[`${key}${i}`] = x));
  };
  if (opts.kind) inList("kind", "k", opts.kind);
  if (opts.status) inList("status", "s", opts.status);
  if (opts.dueBefore != null) { where.push("due_at IS NOT NULL AND due_at < @before"); params.before = opts.dueBefore; }
  if (opts.dueAfter != null) { where.push("due_at >= @after"); params.after = opts.dueAfter; }
  if (opts.search) { where.push("(title LIKE @q OR data LIKE @q)"); params.q = `%${opts.search.replace(/[%_]/g, "")}%`; }
  const order = opts.order === "recent" ? "updated_at DESC" : opts.order === "position" ? "position, created_at" : "due_at IS NULL, due_at, created_at";
  params.limit = opts.limit ?? 500;
  const rows = db().prepare(`SELECT * FROM items WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT @limit`).all(params) as Row[];
  return rows.map(toItem);
}

export function getItem(viewerId: string, id: string): Item | null {
  const r = db().prepare(`SELECT * FROM items WHERE id = @id AND ${VISIBLE}`).get({ id, viewer: viewerId }) as Row | undefined;
  return r ? toItem(r) : null;
}

export function createItem(ownerId: string, kind: string, input: ParsedInput, opts: { visibility?: "shared" | "private"; status?: string; parentId?: string } = {}): Item {
  const def = kindDef(kind);
  const id = newId();
  const now = Date.now();
  const status = opts.status && def.statuses.includes(opts.status) ? opts.status : def.statuses[0];
  db().prepare(`INSERT INTO items (id,kind,owner_id,visibility,title,status,due_at,amount_cents,parent_id,data,position,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, kind, ownerId, opts.visibility ?? def.defaultVisibility, input.title, status, input.due_at, input.amount_cents,
      opts.parentId ?? null, JSON.stringify(input.data), now, now, now);
  return getItem(ownerId, id)!;
}

function requireEditable(viewerId: string, id: string): Item {
  const item = getItem(viewerId, id);
  if (!item) throw new Error("Not found");
  return item;
}

export function updateItem(viewerId: string, id: string, input: ParsedInput, visibility?: "shared" | "private"): Item {
  const item = requireEditable(viewerId, id);
  // Only the owner may change who can see a record.
  const vis = visibility && item.owner_id === viewerId ? visibility : item.visibility;
  db().prepare("UPDATE items SET title=?, due_at=?, amount_cents=?, data=?, visibility=?, updated_at=? WHERE id=?")
    .run(input.title, input.due_at, input.amount_cents, JSON.stringify({ ...item.data, ...input.data }), vis, Date.now(), id);
  return getItem(viewerId, id)!;
}

export function patchData(viewerId: string, id: string, patch: Record<string, unknown>): Item {
  const item = requireEditable(viewerId, id);
  db().prepare("UPDATE items SET data=?, updated_at=? WHERE id=?").run(JSON.stringify({ ...item.data, ...patch }), Date.now(), id);
  return getItem(viewerId, id)!;
}

export function setStatus(viewerId: string, id: string, status: string): Item {
  const item = requireEditable(viewerId, id);
  if (!kindDef(item.kind).statuses.includes(status)) throw new Error(`Invalid status ${status}`);
  db().prepare("UPDATE items SET status=?, updated_at=? WHERE id=?").run(status, Date.now(), id);
  return getItem(viewerId, id)!;
}

export function deleteItem(viewerId: string, id: string): Item {
  const item = requireEditable(viewerId, id);
  db().prepare("DELETE FROM items WHERE id = ?").run(id);
  return item;
}

/**
 * Completes an item. Recurring items roll forward to their next occurrence
 * (keeping a history entry in data.history) instead of closing. Paying a bill
 * only *records* the payment — it never moves money.
 */
export function completeItem(viewerId: string, id: string): { item: Item; rolledTo: number | null } {
  const item = requireEditable(viewerId, id);
  const def: KindDef = kindDef(item.kind);
  if (!def.doneStatus) throw new Error(`${def.label} cannot be completed`);
  const rec = String(item.data.recurrence ?? "none");
  const now = Date.now();
  const history = Array.isArray(item.data.history) ? (item.data.history as unknown[]) : [];
  const entry = { at: now, by: viewerId, due: item.due_at, amount_cents: item.amount_cents };

  return db().transaction(() => {
    if (item.kind === "bill") {
      // Record the payment as an expense so analytics reflect reality.
      createItem(viewerId, "expense", {
        title: item.title, due_at: Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate()),
        amount_cents: item.amount_cents, data: { category: item.data.category ?? "Other", notes: "Recorded from bill", bill_id: item.id },
      }, { visibility: item.visibility });
    }
    if (rec !== "none" && item.due_at != null) {
      const next = addRecurrence(item.due_at, rec);
      db().prepare("UPDATE items SET due_at=?, data=?, updated_at=? WHERE id=?")
        .run(next, JSON.stringify({ ...item.data, history: [entry, ...history].slice(0, 50), last_done: now }), now, id);
      return { item: getItem(viewerId, id)!, rolledTo: next };
    }
    db().prepare("UPDATE items SET status=?, data=?, updated_at=? WHERE id=?")
      .run(def.doneStatus, JSON.stringify({ ...item.data, history: [entry, ...history].slice(0, 50), last_done: now }), now, id);
    return { item: getItem(viewerId, id)!, rolledTo: null };
  })();
}
