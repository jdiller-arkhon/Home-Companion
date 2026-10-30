"use client";
import { useState, useTransition } from "react";
import { Plus, Play, Trash2, X } from "lucide-react";
import * as Switch from "@radix-ui/react-switch";
import clsx from "clsx";
import { saveRoutineAction, toggleRoutine, removeRoutine, runNow } from "@/server/routine-actions";
import { Sheet, Button, inputCls } from "./ui";

type A = { entity_id: string; action: string; value?: number };
export type RoutineRow = { id: string; name: string; trigger: "time" | "last_leaves" | "first_arrives"; after_dark: boolean; time: string; days: number[]; presence: "any" | "home" | "away"; actions: A[]; enabled: boolean; last: string | null };
export type Entity = { id: string; name: string; domain: string };

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const ACTIONS: Record<string, [string, string][]> = {
  light: [["turn_on", "Turn on"], ["turn_off", "Turn off"]], switch: [["turn_on", "Turn on"], ["turn_off", "Turn off"]], fan: [["turn_on", "Turn on"], ["turn_off", "Turn off"]],
  media_player: [["turn_off", "Turn off"]], scene: [["activate", "Activate"]], script: [["activate", "Run"]], lock: [["lock", "Lock"]], cover: [["close", "Close"]],
  climate: [["set_temperature", "Set temperature"], ["turn_off", "Turn off"]], vacuum: [["turn_on", "Start"]],
};
const daysLabel = (d: number[]) => d.length === 7 ? "Every day" : JSON.stringify([...d].sort()) === "[1,2,3,4,5]" ? "Weekdays" : JSON.stringify([...d].sort()) === "[0,6]" ? "Weekends" : d.sort().map((x) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][x]).join(", ");

function Editor({ initial, entities, onDone }: { initial?: RoutineRow; entities: Entity[]; onDone: () => void }) {
  const usable = entities.filter((e) => ACTIONS[e.domain]);
  const [name, setName] = useState(initial?.name ?? "");
  const [time, setTime] = useState(initial?.time ?? "22:30");
  const [trigger, setTrigger] = useState<RoutineRow["trigger"]>(initial?.trigger ?? "time");
  const [afterDark, setAfterDark] = useState(initial?.after_dark ?? false);
  const [days, setDays] = useState<number[]>(initial?.days ?? [0, 1, 2, 3, 4, 5, 6]);
  const [presence, setPresence] = useState(initial?.presence ?? "any");
  const [actions, setActions] = useState<A[]>(initial?.actions ?? []);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const name_ = (id: string) => entities.find((e) => e.id === id)?.name ?? id;
  return (
    <div className="space-y-4">
      <label className="block"><span className="text-[12px] text-fg-2">Name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Goodnight" className={`${inputCls} mt-1.5`} /></label>
      <label className="block"><span className="text-[12px] text-fg-2">When</span>
        <select value={trigger} onChange={(e) => setTrigger(e.target.value as RoutineRow["trigger"])} className={`${inputCls} mt-1.5`}>
          <option value="time">At a time</option><option value="last_leaves">When the last person leaves</option><option value="first_arrives">When the first person gets home</option>
        </select></label>
      {trigger !== "time" && <label className="flex items-center gap-2.5 text-[13px] text-fg-2"><input type="checkbox" checked={afterDark} onChange={(e) => setAfterDark(e.target.checked)} className="size-4 accent-[var(--fg)]" />Only after sunset</label>}
      {trigger === "time" && <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="text-[12px] text-fg-2">Time</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${inputCls} mt-1.5`} /></label>
        <label className="block"><span className="text-[12px] text-fg-2">Only when</span>
          <select value={presence} onChange={(e) => setPresence(e.target.value as RoutineRow["presence"])} className={`${inputCls} mt-1.5`}>
            <option value="any">Always</option><option value="home">Someone is home</option><option value="away">Nobody is home</option>
          </select></label>
      </div>}
      <div className="flex gap-1.5" role="group" aria-label="Days">
        {DAYS.map((d, i) => (
          <button key={i} type="button" aria-pressed={days.includes(i)} onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i])}
            className={clsx("press size-9 rounded-full text-[12px] font-medium", days.includes(i) ? "bg-fg text-bg" : "bg-fill text-fg-2")}>{d}</button>
        ))}
      </div>
      <div>
        <p className="text-[12px] text-fg-2">Actions</p>
        <ul className="mt-2 space-y-2">{actions.map((a, i) => (
          <li key={i} className="flex items-center gap-2 rounded-[10px] bg-fill px-3 py-2 text-[13px]">
            <span className="flex-1 truncate">{ACTIONS[a.entity_id.split(".")[0]]?.find(([k]) => k === a.action)?.[1]} · {name_(a.entity_id)}</span>
            {a.action === "set_temperature" && <input type="number" aria-label="Temperature" value={a.value ?? 68} onChange={(e) => setActions(actions.map((x, j) => j === i ? { ...x, value: +e.target.value } : x))} className="w-16 rounded-md bg-elev px-2 py-1 text-[13px]" />}
            <button type="button" aria-label="Remove action" onClick={() => setActions(actions.filter((_, j) => j !== i))} className="text-fg-3 hover:text-bad"><X size={14} /></button>
          </li>))}</ul>
        <select value="" onChange={(e) => { const [id, act] = e.target.value.split("|"); if (id) setActions([...actions, { entity_id: id, action: act, ...(act === "set_temperature" ? { value: 68 } : {}) }]); }} className={`${inputCls} mt-2`} aria-label="Add action">
          <option value="">Add an action…</option>
          {usable.map((e) => ACTIONS[e.domain].map(([k, l]) => <option key={e.id + k} value={`${e.id}|${k}`}>{l} — {e.name}</option>))}
        </select>
        <p className="mt-1.5 text-[12px] text-fg-3">Routines run unattended, so they can lock but never unlock, and close but never open garage doors.</p>
      </div>
      {error && <p role="alert" className="text-[13px] text-bad">{error}</p>}
      <Button className="w-full" disabled={pending} onClick={() => start(async () => {
        const r = await saveRoutineAction({ name, trigger, after_dark: afterDark, time, days, presence: trigger === "time" ? presence : "any", actions }, initial?.id);
        if (r.error) setError(r.error); else onDone();
      })}>{pending ? "Saving…" : "Save routine"}</Button>
    </div>
  );
}

export function Routines({ routines, entities }: { routines: RoutineRow[]; entities: Entity[] }) {
  const [edit, setEdit] = useState<RoutineRow | "new" | null>(null);
  const [msg, setMsg] = useState<string>();
  const [, start] = useTransition();
  return (
    <div>
      <div className="flex items-center"><p className="text-[13px] text-fg-3">Scheduled scenes and checks that run on their own.</p><Button variant="secondary" className="ml-auto" onClick={() => setEdit("new")}><Plus size={14} />New routine</Button></div>
      {msg && <p className="mt-3 text-[13px] text-fg-2" role="status">{msg}</p>}
      {routines.length === 0 ? (
        <button onClick={() => setEdit("new")} className="press mt-4 w-full rounded-[var(--radius)] border border-dashed border-line py-10 text-[13px] text-fg-3 hover:text-fg">Try “Goodnight” at 10:30 PM, or “Leaving” when the last of you heads out: lights off, doors locked, heat down.</button>
      ) : (
        <ul className="card mt-4 divide-y divide-line">{routines.map((r) => (
          <li key={r.id} className="flex items-center gap-4 px-4 py-3">
            <button onClick={() => setEdit(r)} className="min-w-0 flex-1 text-left">
              <div className="flex items-baseline gap-2"><span className="tnum text-[17px] font-semibold tracking-tight">{r.trigger === "time" ? r.time : r.trigger === "last_leaves" ? "Leaving" : "Arriving"}</span><span className="truncate text-[14px]">{r.name}</span></div>
              <div className="truncate text-[12px] text-fg-3">{daysLabel(r.days)}{r.after_dark ? " · after sunset" : ""} · {r.actions.length} action{r.actions.length > 1 ? "s" : ""}{r.presence !== "any" ? ` · only when ${r.presence === "home" ? "someone's home" : "nobody's home"}` : ""}{r.last ? ` · last: ${r.last}` : ""}</div>
            </button>
            <button aria-label={`Run ${r.name} now`} onClick={() => start(async () => setMsg(await runNow(r.id)))} className="text-fg-3 hover:text-fg"><Play size={15} /></button>
            <Switch.Root checked={r.enabled} onCheckedChange={(v) => start(() => toggleRoutine(r.id, v))} aria-label={`${r.name} enabled`} className="relative h-6 w-10 rounded-full bg-fill transition data-[state=checked]:bg-ok" style={{ border: "1px solid var(--line)" }}>
              <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition data-[state=checked]:translate-x-[18px]" />
            </Switch.Root>
          </li>))}</ul>
      )}
      <Sheet open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit === "new" ? "New routine" : "Edit routine"}>
        {edit && <Editor initial={edit === "new" ? undefined : edit} entities={entities} onDone={() => setEdit(null)} />}
        {edit && edit !== "new" && <Button variant="danger" className="mt-3 w-full" onClick={() => start(async () => { await removeRoutine(edit.id); setEdit(null); })}><Trash2 size={14} />Delete</Button>}
      </Sheet>
    </div>
  );
}
