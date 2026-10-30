"use client";
import { useState } from "react";
import { Mail } from "lucide-react";
import { extractFromEmail, type Extracted } from "@/lib/tracking";
import { RecordForm, type Person } from "./records";
import { Sheet, Button, inputCls } from "./ui";

/** Paste a shipping confirmation; tracking details are pattern-matched locally and pre-fill a package. */
export function PasteEmail({ people }: { people: Person[] }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [found, setFound] = useState<Extracted[] | null>(null);
  const [pick, setPick] = useState<Extracted | null>(null);
  const close = () => { setOpen(false); setText(""); setFound(null); setPick(null); };
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}><Mail size={14} />Paste shipping email</Button>
      <Sheet open={open} onOpenChange={(o) => (o ? setOpen(true) : close())} title="Add from email" description="Paste a shipping confirmation. Hearth reads the tracking number on this device; nothing is sent anywhere.">
        {pick ? (
          <RecordForm kind="package" people={people} onSaved={close}
            prefill={{ title: pick.title ?? "Package", carrier: pick.carrier, tracking: pick.tracking, merchant: pick.merchant ?? "", due_at: pick.expected ?? "" }} />
        ) : (
          <div className="space-y-3">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder="Paste the whole email here…" className={inputCls} />
            {found && found.length === 0 && <p className="text-[13px] text-fg-3">No tracking number found. You can still add the package manually.</p>}
            {found && found.length > 1 && (
              <ul className="space-y-2">{found.map((f) => (
                <li key={f.tracking}><button onClick={() => setPick(f)} className="press w-full rounded-[10px] border border-line px-3 py-2 text-left text-[13px] hover:bg-fill">{f.carrier} · {f.tracking}</button></li>
              ))}</ul>
            )}
            <Button className="w-full" disabled={!text.trim()} onClick={() => { const r = extractFromEmail(text); setFound(r); if (r.length === 1) setPick(r[0]); }}>Find tracking number</Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
