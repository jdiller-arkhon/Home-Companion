"use client";
import { useActionState, useState, useTransition } from "react";
import { FileText, Download, Trash2, Upload, Users, Lock } from "lucide-react";
import { uploadDocs, removeDoc, shareDoc } from "@/server/vault-actions";
import { Sheet, Button, inputCls, Pill } from "./ui";
import { ElevateDialog } from "./elevate";

export type DocRow = { id: string; name: string; folder: string; sizeKb: number; shared: boolean; mine: boolean; added: string; expires: string | null; expiringSoon: boolean; text: string; snippet?: string };

export function VaultUpload() {
  const [open, setOpen] = useState(false);
  const [state, act, pending] = useActionState(async (s: { error?: string; ok?: boolean }, f: FormData) => {
    const r = await uploadDocs(s, f);
    if (r.ok) setOpen(false);
    return r;
  }, {});
  return (
    <>
      <Button onClick={() => setOpen(true)}><Upload size={14} /> Upload</Button>
      <Sheet open={open} onOpenChange={setOpen} title="Add to vault" description="Encrypted on this device. PDFs and photos are made searchable when the AI service is running.">
        <form action={act} className="space-y-4">
          <input type="file" name="files" multiple accept="application/pdf,image/*,text/plain,text/markdown,text/csv" className="block w-full text-[13px] file:mr-3 file:rounded-lg file:border-0 file:bg-fill file:px-3 file:py-2 file:text-[13px]" />
          <label className="block"><span className="text-[12px] text-fg-2">Folder</span><input name="folder" placeholder="Insurance" className={`${inputCls} mt-1.5`} /></label>
          <label className="block"><span className="text-[12px] text-fg-2">Expires (optional)</span><input type="date" name="expires" className={`${inputCls} mt-1.5`} /><span className="mt-1 block text-[12px] text-fg-3">Passports, policies, registrations — you'll get a reminder.</span></label>
          <label className="flex items-center gap-2.5 text-[14px]"><input type="checkbox" name="shared" className="size-4 accent-[var(--fg)]" /> Share with household</label>
          {state.error && <p role="alert" className="text-[13px] text-bad">{state.error}</p>}
          <Button disabled={pending} className="w-full">{pending ? "Encrypting…" : "Upload"}</Button>
        </form>
      </Sheet>
    </>
  );
}

export function VaultList({ docs }: { docs: DocRow[] }) {
  const [elev, setElev] = useState<string | null>(null);
  const [, start] = useTransition();
  const del = (id: string) => start(async () => { const r = await removeDoc(id); if (r.needsElevation) setElev(id); });
  if (!docs.length) return <p className="rounded-[var(--radius)] border border-dashed border-line py-12 text-center text-[13px] text-fg-3">No documents here yet.</p>;
  return (
    <>
      <ul className="card divide-y divide-line">{docs.map((d) => (
        <li key={d.id} className="flex items-center gap-3 px-4 py-3">
          <FileText size={18} strokeWidth={1.5} className="shrink-0 text-fg-3" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[14px]"><span className="truncate">{d.name}</span>{d.shared ? <Users size={11} className="text-fg-3" aria-label="Shared" /> : <Lock size={11} className="text-fg-3" aria-label="Private" />}</div>
            <div className="truncate text-[12px] text-fg-3">{d.snippet ?? `${d.folder} · ${d.sizeKb} KB · added ${d.added} · ${d.text}`}</div>
          </div>
          {d.expires && <Pill tone={d.expiringSoon ? "warn" : "neutral"}>Expires {d.expires}</Pill>}
          {d.mine && <button onClick={() => start(() => shareDoc(d.id, !d.shared))} className="text-[12px] text-fg-3 hover:text-fg">{d.shared ? "Make private" : "Share"}</button>}
          <a href={`/api/vault/${d.id}`} className="text-fg-3 hover:text-fg" aria-label={`Download ${d.name}`}><Download size={15} /></a>
          {d.mine && <button onClick={() => del(d.id)} className="text-fg-3 hover:text-bad" aria-label={`Delete ${d.name}`}><Trash2 size={15} /></button>}
        </li>))}</ul>
      <ElevateDialog open={!!elev} onOpenChange={(o) => !o && setElev(null)} reason="Deleting a document is permanent." onDone={() => elev && del(elev)} />
    </>
  );
}
