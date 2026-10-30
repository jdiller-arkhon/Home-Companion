"use client";
import { useState, useTransition } from "react";
import { Copy, Check, Trash2, Plus } from "lucide-react";
import { createToken, deleteToken } from "@/server/token-actions";
import { Button, inputCls } from "./ui";
import { ElevateDialog } from "./elevate";

export type TokenRow = { id: string; name: string; created: string; lastUsed: string | null; expires: string | null };

/** Issue / list / revoke scoped tokens. The secret (and URL) is shown exactly once. */
export function TokenManager({ kind, tokens, render, placeholder, withDays }: {
  kind: "calendar" | "shortcut" | "share"; tokens: TokenRow[]; placeholder: string; withDays?: boolean;
  render: (secret: string, origin: string) => { url: string; primary?: { href: string; label: string }; hint?: string };
}) {
  const [name, setName] = useState("");
  const [days, setDays] = useState(7);
  const [secret, setSecret] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [elev, setElev] = useState(false);
  const [, start] = useTransition();
  const create = () => start(async () => {
    const r = await createToken(kind, name, days);
    if (r.error === "elevate") return setElev(true);
    if (r.secret) { setSecret(r.secret); setName(""); }
  });
  const shown = secret ? render(secret, window.location.origin) : null;
  return (
    <div className="space-y-4">
      {shown && (
        <div className="rounded-[12px] border border-line bg-fill p-4">
          <p className="text-[12px] font-medium text-fg-2">Copy this now — it won't be shown again.</p>
          <div className="mt-2 flex gap-2">
            <input readOnly value={shown.url} className={`${inputCls} font-mono text-[12px]`} onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" variant="secondary" onClick={() => { navigator.clipboard?.writeText(shown.url); setCopied(true); }}>{copied ? <Check size={14} /> : <Copy size={14} />}</Button>
          </div>
          {shown.primary && <a href={shown.primary.href} className="press mt-3 inline-flex rounded-[10px] bg-fg px-3.5 py-2 text-[13px] font-medium text-bg">{shown.primary.label}</a>}
          {shown.hint && <p className="mt-2 text-[12px] text-fg-3">{shown.hint}</p>}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} className={`${inputCls} max-w-[260px]`} aria-label="Name" />
        {withDays && (
          <select value={days} onChange={(e) => setDays(+e.target.value)} className={`${inputCls} max-w-[140px]`} aria-label="Expires after">
            {[1, 3, 7, 14, 30].map((d) => <option key={d} value={d}>{d} day{d > 1 ? "s" : ""}</option>)}
          </select>
        )}
        <Button type="button" variant="secondary" onClick={create}><Plus size={14} />Create</Button>
      </div>
      {tokens.length > 0 && (
        <ul className="divide-y divide-line rounded-[12px] border border-line">{tokens.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
            <span className="flex-1 truncate">{t.name}</span>
            <span className="text-[12px] text-fg-3">{t.expires ? `expires ${t.expires}` : t.lastUsed ? `used ${t.lastUsed}` : `created ${t.created}`}</span>
            <button onClick={() => start(() => deleteToken(t.id))} aria-label={`Revoke ${t.name}`} className="text-fg-3 hover:text-bad"><Trash2 size={14} /></button>
          </li>))}</ul>
      )}
      <ElevateDialog open={elev} onOpenChange={setElev} reason="Links work without signing in, so creating one needs your PIN." onDone={create} />
    </div>
  );
}
