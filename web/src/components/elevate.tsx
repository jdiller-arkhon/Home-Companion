"use client";
import { useState } from "react";
import { Sheet, Button, inputCls } from "./ui";
import { elevate } from "@/server/elevate-action";

/** Asks for PIN/password, then runs `onDone`. Used for locks, deletes, money. */
export function ElevateDialog({ open, onOpenChange, reason, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; reason: string; onDone: () => void }) {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Confirm it's you" description={reason}>
      <form onSubmit={async (e) => {
        e.preventDefault(); setBusy(true);
        const r = await elevate(secret);
        setBusy(false); setSecret("");
        if (!r.ok) return setError(r.error);
        onOpenChange(false); onDone();
      }} className="space-y-3">
        <input autoFocus type="password" inputMode="text" autoComplete="current-password" placeholder="PIN or password" value={secret} onChange={(e) => setSecret(e.target.value)} className={inputCls} />
        {error && <p role="alert" className="text-[13px] text-bad">{error}</p>}
        <Button disabled={busy || !secret} className="w-full">Confirm</Button>
      </form>
    </Sheet>
  );
}
