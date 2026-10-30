"use client";
import { useState, useTransition } from "react";
import { Camera } from "lucide-react";
import { captureFromPhoto, type CaptureResult } from "@/server/capture-actions";
import { RecordForm, type Person } from "./records";
import { Sheet, Button, inputCls } from "./ui";

export function PhotoCapture({ people }: { people: Person[] }) {
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<CaptureResult | null>(null);
  const [pending, start] = useTransition();
  const close = () => { setOpen(false); setRes(null); };
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}><Camera size={14} />Add from photo</Button>
      <Sheet open={open} onOpenChange={(o) => (o ? setOpen(true) : close())} title="Add from a photo" description="Photograph a receipt or the label inside the appliance door. The photo is saved encrypted in the Vault and read on this server.">
        {res?.fields ? (
          <div className="space-y-3">
            {res.note && <p className="text-[13px] text-fg-2" role="status">{res.note}</p>}
            <RecordForm kind="appliance" people={people} onSaved={close} prefill={res.fields} />
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => setRes(await captureFromPhoto(fd))); }} className="space-y-4">
            <input type="file" name="photo" accept="image/*" capture="environment" className={inputCls} />
            {res?.error && <p role="alert" className="text-[13px] text-bad">{res.error}</p>}
            <Button disabled={pending} className="w-full">{pending ? "Reading the photo…" : "Read photo"}</Button>
          </form>
        )}
      </Sheet>
    </>
  );
}
