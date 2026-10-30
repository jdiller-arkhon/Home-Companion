"use client";
import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { forget, teach } from "@/server/memory-actions";
import { inputCls } from "./ui";

export function Memories({ items }: { items: { id: string; content: string; household: boolean }[] }) {
  const [text, setText] = useState("");
  const [, start] = useTransition();
  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); const t = text; setText(""); start(() => teach(t, true)); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Teach it something…" className={`${inputCls} text-[13px]`} />
      </form>
      <ul className="mt-3 space-y-1.5">{items.map((m) => (
        <li key={m.id} className="group flex items-start gap-2 text-[13px] text-fg-2">
          <span className="flex-1">{m.content}</span>
          <button onClick={() => start(() => forget(m.id))} aria-label="Forget" className="text-fg-3 opacity-0 group-hover:opacity-100 hover:text-bad focus:opacity-100"><X size={13} /></button>
        </li>))}</ul>
      {items.length === 0 && <p className="mt-3 text-[12px] text-fg-3">Nothing remembered yet. Preferences you share in chat appear here, and you can remove any of them.</p>}
    </div>
  );
}
