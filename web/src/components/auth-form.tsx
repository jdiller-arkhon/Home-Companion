"use client";
import { useActionState } from "react";
import type { FormState } from "@/server/session-actions";

type Field = { name: string; label: string; type?: string; autoComplete?: string };

export function AuthForm({ action, fields, submit }: { action: (s: FormState, f: FormData) => Promise<FormState>; fields: Field[]; submit: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-3">
      {fields.map((f) => (
        <label key={f.name} className="block">
          <span className="text-[12px] text-fg-2">{f.label}</span>
          <input name={f.name} type={f.type ?? "text"} autoComplete={f.autoComplete} required
            className="mt-1.5 w-full rounded-[10px] border border-line bg-elev px-3.5 py-2.5 text-[15px] outline-none transition focus:border-fg-3 focus:ring-4 focus:ring-fill" />
        </label>
      ))}
      {state.error && <p role="alert" className="text-[13px] text-bad">{state.error}</p>}
      <button disabled={pending} className="press mt-2 w-full rounded-[10px] bg-fg py-2.5 text-[14px] font-medium text-bg disabled:opacity-50">
        {pending ? "One moment…" : submit}
      </button>
    </form>
  );
}
