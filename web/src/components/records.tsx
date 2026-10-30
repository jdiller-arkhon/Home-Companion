"use client";
import React, { startTransition, useActionState, useEffect, useState, useTransition } from "react";
import { Check, Plus, Trash2, Lock, Repeat, ExternalLink } from "lucide-react";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { KINDS, statusLabel, type Field } from "@/server/items/kinds";
import { saveItem, completeAction, deleteAction, statusAction, type ItemFormState } from "@/server/item-actions";
import { Sheet, Button, inputCls, Pill } from "./ui";
import { ElevateDialog } from "./elevate";
import { sendRecipeToGroceries } from "@/server/meal-actions";
import { nudge } from "@/server/nudge-actions";
import { ShoppingBasket, BellRing } from "lucide-react";

export type RecordRow = {
  id: string; kind: string; title: string; status: string; visibility: "shared" | "private"; mine: boolean;
  dueLabel: string | null; dueTone: "neutral" | "warn" | "bad"; amount: string | null; meta: string[];
  recurring: boolean; url: string | null; form: Record<string, string | boolean>;
  group?: string; doneBy?: string;
};
export type Person = { id: string; name: string };

function FieldInput({ f, value, people, error }: { f: Field; value: string | boolean | undefined; people: Person[]; error?: string }) {
  const common = { name: f.name, required: f.required, "aria-invalid": !!error, className: clsx(inputCls, error && "border-bad") };
  let control: React.ReactNode;
  switch (f.type) {
    case "textarea": control = <textarea {...common} rows={4} defaultValue={(value as string) ?? ""} placeholder={f.placeholder} />; break;
    case "select": control = (
      <select {...common} defaultValue={(value as string) ?? (f.required ? f.options?.[0] : "")}>
        {!f.required && <option value="">—</option>}
        {f.options?.map((o) => <option key={o} value={o}>{statusLabel(o)}</option>)}
      </select>); break;
    case "user": control = (
      <select {...common} defaultValue={(value as string) ?? ""}><option value="">Anyone</option>{people.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}</select>); break;
    case "bool": return (
      <label className="flex items-center gap-2.5 text-[14px]"><input type="checkbox" name={f.name} defaultChecked={!!value} className="size-4 accent-[var(--fg)]" />{f.label}</label>);
    default: control = (
      <input {...common} type={{ money: "text", date: "date", datetime: "datetime-local", number: "number", url: "url", text: "text" }[f.type as string] ?? "text"}
        inputMode={f.type === "money" ? "decimal" : undefined} step={f.type === "number" ? "any" : undefined}
        defaultValue={(value as string) ?? ""} placeholder={f.type === "money" ? "0.00" : f.placeholder} />);
  }
  return (
    <label className="block">
      <span className="text-[12px] text-fg-2">{f.label}{f.required && <span className="text-fg-3"> *</span>}</span>
      <div className="mt-1.5">{control}</div>
      {error ? <span className="mt-1 block text-[12px] text-bad">{error}</span> : f.hint && <span className="mt-1 block text-[12px] text-fg-3">{f.hint}</span>}
    </label>
  );
}

export function RecordForm({ kind, row, people, onSaved, prefill }: { kind: string; row?: RecordRow; people: Person[]; onSaved: () => void; prefill?: Record<string, string> }) {
  const def = KINDS[kind];
  const [state, action, pending] = useActionState<ItemFormState, FormData>(saveItem, {});
  useEffect(() => { if (state.ok) onSaved(); }, [state, onSaved]);
  const values = row?.form ?? prefill ?? {};
  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }} className="space-y-4">
      <input type="hidden" name="_kind" value={kind} />
      {row && <input type="hidden" name="_id" value={row.id} />}
      {def.fields.map((f) => <FieldInput key={f.name} f={f} value={values[f.name]} people={people} error={state.fieldErrors?.[f.name]} />)}
      {(!row || row.mine) && (
        <label className="flex items-center gap-2.5 text-[13px] text-fg-2">
          <input type="checkbox" name="_private" defaultChecked={row ? row.visibility === "private" : def.defaultVisibility === "private"} className="size-4 accent-[var(--fg)]" />
          <Lock size={13} /> Private — only visible to me
        </label>
      )}
      {state.error && !state.fieldErrors && <p role="alert" className="text-[13px] text-bad">{state.error}</p>}
      <Button disabled={pending} className="w-full">{pending ? "Saving…" : row ? "Save changes" : `Add ${def.label.toLowerCase()}`}</Button>
    </form>
  );
}

function completeLabel(kind: string) {
  return kind === "package" ? "Delivered" : "Done";
}

export function RecordBoard({ kind, rows, people, emptyText }: { kind: string; rows: RecordRow[]; people: Person[]; emptyText: string }) {
  const def = KINDS[kind];
  const [editing, setEditing] = useState<RecordRow | "new" | null>(null);
  const [elevateFor, setElevateFor] = useState<string | null>(null);
  const [note, setNote] = useState<string>();
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const complete = (id: string) => { setCompleting((s) => new Set(s).add(id)); start(() => completeAction(id)); };
  const [, start] = useTransition();
  const canComplete = !!def.doneStatus;

  const remove = (id: string) => start(async () => {
    const r = await deleteAction(id);
    if (r.needsElevation) setElevateFor(id);
    else setEditing(null);
  });

  return (
    <div>
      <div className="flex items-center mb-3">
        <h2 className="text-[15px] font-semibold tracking-tight">{def.plural}</h2>
        <span className="ml-2 text-[13px] text-fg-3 tnum">{rows.length || ""}</span>
        <Button variant="secondary" className="ml-auto" onClick={() => setEditing("new")}><Plus size={14} /> Add</Button>
      </div>
      {note && <p className="mb-3 text-[13px] text-fg-2" role="status">{note}</p>}
      {rows.length === 0 ? (
        <button onClick={() => setEditing("new")} className="press w-full rounded-[var(--radius)] border border-dashed border-line py-10 text-[13px] text-fg-3 hover:text-fg hover:border-fg-3">{emptyText}</button>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          <AnimatePresence initial={false}>
          {rows.flatMap((r, i) => [
            r.group && r.group !== rows[i - 1]?.group ? <motion.li layout key={`g-${r.group}`} className="eyebrow bg-fill/50 px-4 py-1.5">{r.group}</motion.li> : null,
            <motion.li key={r.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="group flex items-center gap-3 overflow-hidden px-4 py-3 hover:bg-fill/60">
              {canComplete && r.status !== def.doneStatus && (
                <button onClick={() => complete(r.id)} aria-label={`${completeLabel(kind)}: ${r.title}`} title={completeLabel(kind)} disabled={completing.has(r.id)}
                  className={clsx("press grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-200",
                    completing.has(r.id) ? "pop border-ok bg-ok text-white" : "text-transparent hover:border-ok hover:text-ok")} style={completing.has(r.id) ? undefined : { borderColor: "var(--line-strong)" }}>
                  <Check size={12} strokeWidth={3} />
                </button>
              )}
              <button onClick={() => setEditing(r)} className="min-w-0 flex-1 text-left">
                <div className={clsx("flex items-center gap-2 text-[14px] transition-colors duration-300", (r.status === def.doneStatus || completing.has(r.id)) && "text-fg-3 line-through")}>
                  <span className="truncate">{r.title}</span>
                  {r.visibility === "private" && <Lock size={11} className="shrink-0 text-fg-3" aria-label="Private" />}
                  {r.recurring && <Repeat size={11} className="shrink-0 text-fg-3" aria-label="Repeats" />}
                </div>
                {r.meta.length > 0 && <div className="mt-0.5 truncate text-[12px] text-fg-3">{r.meta.join(" · ")}</div>}
              </button>
              {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-fg-3 hover:text-fg" aria-label="Open link"><ExternalLink size={14} /></a>}
              {kind === "package" && r.status !== "delivered" ? (
                <select aria-label="Status" value={r.status} onChange={(e) => start(() => statusAction(r.id, e.target.value))} className="rounded-md bg-transparent text-[12px] text-fg-2">
                  {def.statuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                </select>
              ) : r.status !== def.statuses[0] && !r.doneBy && <Pill>{statusLabel(r.status)}</Pill>}
              {r.dueLabel && <Pill tone={r.dueTone}>{r.dueLabel}</Pill>}
              {r.amount && <span className="tnum text-[14px] font-medium">{r.amount}</span>}
              {r.doneBy && <span className="text-[12px] text-fg-3">✓ {r.doneBy}</span>}
              {["task", "chore", "errand"].includes(kind) && r.status === "open" && (
                <button onClick={() => start(async () => setNote(await nudge(r.id)))} aria-label={`Ask the household about ${r.title}`} title="Ask the household" className="text-fg-3 opacity-0 transition group-hover:opacity-100 hover:text-accent focus:opacity-100"><BellRing size={14} /></button>
              )}
            </motion.li>,
          ])}
          </AnimatePresence>
        </ul>
      )}
      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)} title={editing === "new" ? `New ${def.label.toLowerCase()}` : def.label}>
        {editing && <RecordForm kind={kind} row={editing === "new" ? undefined : editing} people={people} onSaved={() => setEditing(null)} />}
        {editing && editing !== "new" && kind === "recipe" && (
          <Button variant="secondary" className="mt-3 w-full" onClick={() => start(async () => { setNote(await sendRecipeToGroceries(editing.id)); setEditing(null); })}><ShoppingBasket size={14} /> Send ingredients to groceries</Button>
        )}
        {editing && editing !== "new" && (
          <Button variant="danger" className="mt-3 w-full" onClick={() => remove(editing.id)}><Trash2 size={14} /> Delete</Button>
        )}
      </Sheet>
      <ElevateDialog open={!!elevateFor} onOpenChange={(o) => !o && setElevateFor(null)} reason="Deleting history needs your PIN or password."
        onDone={() => elevateFor && remove(elevateFor)} />
    </div>
  );
}
