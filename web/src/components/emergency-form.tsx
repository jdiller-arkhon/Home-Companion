"use client";
import { startTransition, useActionState } from "react";
import { saveCard } from "@/server/emergency-actions";
import { Button, inputCls } from "./ui";

type F = { name: string; label: string; group: string; multiline?: boolean; placeholder?: string };

export function EmergencyForm({ fields, values, hasWifi }: { fields: readonly F[]; values: Record<string, string>; hasWifi: boolean }) {
  const [state, act, pending] = useActionState(saveCard, {});
  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => act(fd)); }} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.name} className={f.multiline ? "block sm:col-span-2" : "block"}>
            <span className="text-[12px] text-fg-2">{f.label}</span>
            {f.multiline ? <textarea name={f.name} rows={3} defaultValue={values[f.name] ?? ""} placeholder={f.placeholder} className={`${inputCls} mt-1.5`} />
              : <input name={f.name} defaultValue={values[f.name] ?? ""} placeholder={f.placeholder} className={`${inputCls} mt-1.5`} />}
          </label>
        ))}
        <label className="block"><span className="text-[12px] text-fg-2">Wi-Fi password</span>
          <input name="wifi_password" type="password" autoComplete="off" placeholder={hasWifi ? "•••••• (stored encrypted)" : ""} className={`${inputCls} mt-1.5`} /></label>
        <div className="flex flex-col justify-end gap-2 text-[13px] text-fg-2">
          <label className="flex items-center gap-2.5"><input type="checkbox" name="share_wifi" defaultChecked={values.share_wifi === "on"} className="size-4 accent-[var(--fg)]" />Include Wi-Fi password on shared cards</label>
          {hasWifi && <label className="flex items-center gap-2.5"><input type="checkbox" name="clear_wifi" className="size-4 accent-[var(--fg)]" />Remove stored Wi-Fi password</label>}
        </div>
      </div>
      <div className="flex items-center gap-3"><Button disabled={pending}>{pending ? "Saving…" : "Save card"}</Button>{state.ok && <span className="text-[13px] text-ok" role="status">Saved.</span>}</div>
    </form>
  );
}
