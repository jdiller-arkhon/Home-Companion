"use client";
import { useActionState, useTransition } from "react";
import { RefreshCw, Trash2, Users } from "lucide-react";
import { addCalendar, removeCalendar, syncNow } from "@/server/calendar-actions";
import { Button, inputCls, Pill } from "./ui";

type Cal = { id: string; name: string; shared: boolean; mine: boolean; status: string; ok: boolean };

export function ExternalCalendars({ cals }: { cals: Cal[] }) {
  const [state, act, pending] = useActionState(addCalendar, {});
  const [, start] = useTransition();
  return (
    <div className="space-y-4">
      {cals.length > 0 && (
        <ul className="divide-y divide-line rounded-[12px] border border-line">{cals.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
            <span className="flex-1 truncate">{c.name} {c.shared && <Users size={11} className="ml-1 inline text-fg-3" aria-label="Shared" />}</span>
            <Pill tone={c.ok ? "neutral" : "bad"}>{c.status}</Pill>
            <button onClick={() => start(() => syncNow(c.id))} aria-label={`Refresh ${c.name}`} className="text-fg-3 hover:text-fg"><RefreshCw size={14} /></button>
            {c.mine && <button onClick={() => start(() => removeCalendar(c.id))} aria-label={`Remove ${c.name}`} className="text-fg-3 hover:text-bad"><Trash2 size={14} /></button>}
          </li>))}</ul>
      )}
      <form action={act} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
        <input name="name" placeholder="Work, School…" className={inputCls} aria-label="Calendar name" />
        <input name="url" required placeholder="webcal:// or https:// iCal address" className={inputCls} aria-label="Calendar address" />
        <Button disabled={pending}>{pending ? "Adding…" : "Subscribe"}</Button>
        <label className="flex items-center gap-2 text-[13px] text-fg-2 sm:col-span-3"><input type="checkbox" name="shared" className="size-4 accent-[var(--fg)]" />Show to everyone in the household</label>
      </form>
      {state.error && <p role="alert" className="text-[13px] text-bad">{state.error}</p>}
      <p className="text-[12px] text-fg-3">iCloud: Calendar app → ⓘ next to a calendar → Public Calendar → Share Link. Google: Settings → your calendar → “Secret address in iCal format”. Hearth stores the address encrypted and checks it every 30 minutes.</p>
    </div>
  );
}
