"use client";
import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { say } from "./voice";
import { inputCls } from "./ui";

type V = { id: string; label: string; installed: boolean };

export function VoicePicker({ value, name }: { value: string; name: string }) {
  const [voices, setVoices] = useState<V[]>([]);
  const [sel, setSel] = useState(value);
  const [msg, setMsg] = useState<string>();
  useEffect(() => { fetch("/api/voice/voices").then((r) => r.json()).then((j) => { setVoices(j.voices ?? []); if (j.error) setMsg(j.error); }); }, []);
  return (
    <label className="block sm:col-span-2">
      <span className="text-[12px] text-fg-2">Voice</span>
      <div className="mt-1.5 flex gap-2">
        <select name="assistant_voice" value={sel} onChange={(e) => setSel(e.target.value)} className={inputCls}>
          {voices.length === 0 && <option value={value}>{value}</option>}
          {voices.map((v) => <option key={v.id} value={v.id}>{v.label}{v.installed ? "" : " (not downloaded)"}</option>)}
        </select>
        <button type="button" onClick={() => say(`Hi, I'm ${name}. Here's how I sound.`, sel).then(() => setMsg(undefined)).catch((e) => setMsg(e.message))}
          className="press inline-flex items-center gap-1.5 rounded-[10px] border border-line px-3 text-[13px] hover:bg-fill"><Play size={13} />Preview</button>
      </div>
      {msg && <span className="mt-1 block text-[12px] text-fg-3">{msg}</span>}
    </label>
  );
}
