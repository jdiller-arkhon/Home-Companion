"use client";
import { useActionState, useState } from "react";
import { FileUp } from "lucide-react";
import { importBankFile } from "@/server/import-actions";
import { Sheet, Button, inputCls } from "./ui";

export function BankImport() {
  const [open, setOpen] = useState(false);
  const [state, act, pending] = useActionState(importBankFile, {});
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}><FileUp size={14} />Import statement</Button>
      <Sheet open={open} onOpenChange={setOpen} title="Import from your bank" description="Download transactions from Wescom online banking (Quicken/QFX, OFX or CSV), then choose the file here. No login is ever stored.">
        <form action={act} className="space-y-4">
          <input type="file" name="file" accept=".ofx,.qfx,.qbo,.csv,text/csv" className={inputCls} />
          <label className="block"><span className="text-[12px] text-fg-2">Account name (optional)</span><input name="account" placeholder="Wescom Checking" className={`${inputCls} mt-1.5`} /></label>
          <label className="flex items-center gap-2.5 text-[13px] text-fg-2"><input type="checkbox" name="private" className="size-4 accent-[var(--fg)]" />Keep these transactions private to me</label>
          <ol className="list-decimal space-y-1 pl-5 text-[12px] text-fg-3">
            <li>Sign in to Wescom online banking on a computer.</li>
            <li>Open the account → Transactions → Download/Export.</li>
            <li>Pick <b>Quicken (QFX)</b> or OFX to include your balance; CSV works for transactions only.</li>
          </ol>
          {state.message && <p className="text-[13px] text-ok" role="status">{state.message}</p>}
          {state.error && <p className="text-[13px] text-bad" role="alert">{state.error}</p>}
          <Button disabled={pending} className="w-full">{pending ? "Importing…" : "Import"}</Button>
        </form>
      </Sheet>
    </>
  );
}
