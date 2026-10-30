"use client";
import { useRef, useState, useTransition } from "react";
import clsx from "clsx";
import { Upload, MapPin, Check } from "lucide-react";
import type { Device } from "@/server/integrations/homeassistant";
import type { Plan, Pin } from "@/server/floorplan";
import { uploadPlan, updatePins } from "@/server/floorplan-actions";
import { controlDevice } from "@/server/device-actions";
import { Button, inputCls } from "./ui";

const ON = ["on", "open", "unlocked", "heat", "cool", "playing"];

export function FloorPlan({ plan, devices }: { plan: Plan; devices: Device[] }) {
  const [editing, setEditing] = useState(!plan.hasImage);
  const [pins, setPins] = useState<Record<string, Pin>>(plan.pins);
  const [placing, setPlacing] = useState<string>("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const placeable = devices.filter((d) => !["person", "automation", "script"].includes(d.domain));

  if (!plan.hasImage || (editing && !plan.hasImage)) {
    return (
      <form action={(f) => start(async () => { const r = await uploadPlan(f); if (r.error) setError(r.error); })} className="card mx-auto max-w-[520px] space-y-4 p-6 text-center">
        <h2 className="text-[17px] font-semibold tracking-tight">Add a floor plan</h2>
        <p className="text-[14px] text-fg-2">Upload a picture of your layout (a sketch or a photo of a plan works). It's stored encrypted, then you can pin devices to rooms.</p>
        <input type="file" name="image" accept="image/png,image/jpeg,image/webp" className={inputCls} />
        {error && <p role="alert" className="text-[13px] text-bad">{error}</p>}
        <Button disabled={pending}><Upload size={14} />{pending ? "Uploading…" : "Upload"}</Button>
      </form>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <select value={placing} onChange={(e) => setPlacing(e.target.value)} className={`${inputCls} max-w-[280px]`} aria-label="Device to place">
              <option value="">Choose a device, then tap the plan…</option>
              {placeable.map((d) => <option key={d.id} value={d.id}>{pins[d.id] ? "✓ " : ""}{d.name}</option>)}
            </select>
            {placing && pins[placing] && <Button variant="ghost" onClick={() => { const { [placing]: _, ...rest } = pins; setPins(rest); }}>Remove pin</Button>}
            <Button className="ml-auto" disabled={pending} onClick={() => start(async () => { await updatePins(pins); setEditing(false); setPlacing(""); })}><Check size={14} />Done</Button>
          </>
        ) : (
          <Button variant="secondary" className="ml-auto" onClick={() => setEditing(true)}><MapPin size={14} />Arrange devices</Button>
        )}
      </div>
      {error && <p role="alert" className="mb-2 text-[13px] text-bad">{error}</p>}
      <div ref={box} className={clsx("card relative overflow-hidden", editing && placing && "cursor-crosshair")}
        onClick={(e) => {
          if (!editing || !placing || !box.current) return;
          const r = box.current.getBoundingClientRect();
          setPins({ ...pins, [placing]: { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 } });
        }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/floorplan?v=${plan.version}`} alt="Floor plan" className="block w-full select-none opacity-90 dark:invert dark:opacity-70" draggable={false} />
        {Object.entries(pins).map(([id, p]) => {
          const d = devices.find((x) => x.id === id);
          if (!d) return null;
          const on = ON.includes(d.state);
          return (
            <button key={id} style={{ left: `${p.x}%`, top: `${p.y}%` }} disabled={editing || pending}
              onClick={(e) => { e.stopPropagation(); if (["light", "switch", "fan"].includes(d.domain)) start(async () => { const r = await controlDevice({ entityId: id, action: "toggle" }); if (r.error) setError(r.error); }); }}
              title={`${d.name}: ${d.state}`} aria-label={`${d.name}, ${d.state}`}
              className={clsx("press group absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-[11px] font-medium shadow-md", !d.available ? "bg-bad text-white" : on ? "bg-fg text-bg" : "bg-elev text-fg-2", placing === id && "ring-2 ring-accent")}
              >
              <span className={clsx("mr-1 inline-block size-1.5 rounded-full align-middle", on ? (d.domain === "lock" ? "bg-warn" : "bg-[#f5c451]") : "bg-fg-3")} />{d.name}
            </button>
          );
        })}
      </div>
      {!editing && Object.keys(pins).length === 0 && <p className="mt-3 text-[13px] text-fg-3">Tap “Arrange devices” to pin lights, locks and sensors to rooms.</p>}
    </div>
  );
}
