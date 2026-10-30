"use client";
import { useState, useTransition } from "react";
import { Lightbulb, Lock, LockOpen, Thermometer, Power, Fan, Gauge, DoorOpen, Clapperboard, Wifi, WifiOff, Minus, Plus, Warehouse } from "lucide-react";
import clsx from "clsx";
import type { Device } from "@/server/integrations/homeassistant";
import { controlDevice, type DeviceCommand } from "@/server/device-actions";
import { ElevateDialog } from "./elevate";

const ICON: Record<string, React.ElementType> = { light: Lightbulb, switch: Power, fan: Fan, climate: Thermometer, sensor: Gauge, binary_sensor: DoorOpen, scene: Clapperboard, script: Clapperboard, cover: Warehouse };

export function DeviceGrid({ devices }: { devices: Device[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [elevate, setElevate] = useState<DeviceCommand | null>(null);
  const [filter, setFilter] = useState<string>("All");

  const run = (cmd: DeviceCommand) => start(async () => {
    setError(undefined);
    const r = await controlDevice(cmd);
    if (r.needsElevation) setElevate(cmd);
    else if (r.error) setError(r.error);
  });

  const areas = ["All", ...Array.from(new Set(devices.map((d) => d.area ?? "Unassigned"))).sort()];
  const shown = devices.filter((d) => filter === "All" || (d.area ?? "Unassigned") === filter);
  const scenes = shown.filter((d) => d.domain === "scene" || d.domain === "script");
  const controls = shown.filter((d) => !["scene", "script", "automation", "person"].includes(d.domain));

  return (
    <div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto pb-1">
        {areas.map((a) => (
          <button key={a} onClick={() => setFilter(a)} className={clsx("press whitespace-nowrap rounded-full px-3 py-1.5 text-[13px]", filter === a ? "bg-fg text-bg" : "bg-fill text-fg-2 hover:text-fg")}>{a}</button>
        ))}
      </div>
      {error && <p role="alert" className="mt-4 text-[13px] text-bad">{error}</p>}
      {scenes.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {scenes.map((s) => (
            <button key={s.id} disabled={pending} onClick={() => run({ entityId: s.id, action: "activate" })} className="press card flex items-center gap-2 px-3.5 py-2 text-[13px] hover:bg-fill">
              <Clapperboard size={14} className="text-fg-3" />{s.name}
            </button>
          ))}
        </div>
      )}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {controls.map((d) => <Tile key={d.id} d={d} run={run} busy={pending} />)}
      </div>
      <ElevateDialog open={!!elevate} onOpenChange={(o) => !o && setElevate(null)} reason="Unlocking doors and opening garage doors needs your PIN or password." onDone={() => elevate && run(elevate)} />
    </div>
  );
}

function Tile({ d, run, busy }: { d: Device; run: (c: DeviceCommand) => void; busy: boolean }) {
  const on = ["on", "open", "unlocked", "heat", "cool", "heat_cool", "playing"].includes(d.state);
  const Icon = d.domain === "lock" ? (d.state === "unlocked" ? LockOpen : Lock) : ICON[d.domain] ?? Power;
  const toggleable = ["light", "switch", "fan", "media_player"].includes(d.domain);
  const tile = clsx("card rise flex min-h-[124px] flex-col p-4 text-left", on && d.domain === "light" && "ring-1 ring-warn/30");

  const body = (
    <>
      <div className="flex items-start">
        <div className={clsx("grid size-9 place-items-center rounded-full", on ? "bg-fg text-bg" : "bg-fill text-fg-2")}><Icon size={17} strokeWidth={1.75} /></div>
        {d.available ? null : <WifiOff size={14} className="ml-auto text-bad" aria-label="Offline" />}
      </div>
      <div className="mt-auto pt-4">
        <div className="truncate text-[14px] font-medium">{d.name}</div>
        <div className="mt-0.5 text-[12px] text-fg-3 capitalize">{state(d)}</div>
      </div>
    </>
  );

  if (toggleable) return <button disabled={busy || !d.available} onClick={() => run({ entityId: d.id, action: "toggle" })} className={clsx(tile, "press hover:bg-fill")} aria-pressed={on}>{body}</button>;
  return (
    <div className={tile}>
      {body}
      {d.domain === "lock" && d.available && (
        <button disabled={busy} onClick={() => run({ entityId: d.id, action: d.state === "locked" ? "unlock" : "lock" })} className="press mt-3 rounded-lg bg-fill py-1.5 text-[12px] font-medium hover:bg-fg hover:text-bg">
          {d.state === "locked" ? "Unlock" : "Lock"}
        </button>
      )}
      {d.domain === "cover" && d.available && (
        <button disabled={busy} onClick={() => run({ entityId: d.id, action: d.state === "open" ? "close" : "open" })} className="press mt-3 rounded-lg bg-fill py-1.5 text-[12px] font-medium hover:bg-fg hover:text-bg">
          {d.state === "open" ? "Close" : "Open"}
        </button>
      )}
      {d.domain === "climate" && d.available && typeof d.attributes.temperature === "number" && (
        <div className="mt-3 flex items-center justify-between rounded-lg bg-fill px-1 py-1">
          <button aria-label="Cooler" disabled={busy} onClick={() => run({ entityId: d.id, action: "set_temperature", value: (d.attributes.temperature as number) - 1 })} className="press rounded-md p-1 hover:bg-elev"><Minus size={14} /></button>
          <span className="tnum text-[13px] font-medium">{d.attributes.temperature as number}°</span>
          <button aria-label="Warmer" disabled={busy} onClick={() => run({ entityId: d.id, action: "set_temperature", value: (d.attributes.temperature as number) + 1 })} className="press rounded-md p-1 hover:bg-elev"><Plus size={14} /></button>
        </div>
      )}
    </div>
  );
}

function state(d: Device) {
  if (!d.available) return "Offline";
  if (d.domain === "sensor") return `${d.state}${d.unit ? ` ${d.unit}` : ""}`;
  if (d.domain === "climate") return `${d.state} · ${d.attributes.current_temperature ?? "—"}° now`;
  if (d.domain === "light" && d.state === "on" && typeof d.attributes.brightness === "number") return `On · ${Math.round(((d.attributes.brightness as number) / 255) * 100)}%`;
  return d.state.replace(/_/g, " ");
}

export { Wifi };
