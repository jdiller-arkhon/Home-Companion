"use client";
import { startTransition, useActionState } from "react";
import type { Result } from "@/server/settings-actions";
import { Button, inputCls } from "./ui";

export type SF = { name: string; label: string; type?: string; value?: string | number | boolean | null; options?: [string, string][]; placeholder?: string; hint?: string };

export function SettingsForm({ action, fields, submit = "Save", extra }: { action: (s: Result, f: FormData) => Promise<Result>; fields: SF[]; submit?: string; extra?: React.ReactNode }) {
  const [state, act, pending] = useActionState(action, {});
  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => act(fd)); }} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => f.type === "checkbox" ? (
          <label key={f.name} className="flex items-center gap-2.5 text-[14px] sm:col-span-2"><input type="checkbox" name={f.name} defaultChecked={!!f.value} className="size-4 accent-[var(--fg)]" />{f.label}</label>
        ) : (
          <label key={f.name} className="block">
            <span className="text-[12px] text-fg-2">{f.label}</span>
            {f.options ? (
              <select name={f.name} defaultValue={String(f.value ?? "")} className={`${inputCls} mt-1.5`}>{f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            ) : (
              <input name={f.name} type={f.type ?? "text"} defaultValue={f.value == null ? "" : String(f.value)} placeholder={f.placeholder} autoComplete="off" className={`${inputCls} mt-1.5`} />
            )}
            {f.hint && <span className="mt-1 block text-[12px] text-fg-3">{f.hint}</span>}
          </label>
        ))}
      </div>
      {extra}
      <div className="flex items-center gap-3">
        <Button disabled={pending}>{pending ? "Saving…" : submit}</Button>
        {state.message && <span className="text-[13px] text-ok" role="status">{state.message}</span>}
        {state.error && <span className="text-[13px] text-bad" role="alert">{state.error}</span>}
      </div>
    </form>
  );
}
