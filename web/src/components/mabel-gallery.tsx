"use client";
import { useEffect, useState } from "react";
import { Mabel, type MabelState } from "./mabel";

/** Live gallery. "Speaking" cells are driven by a synthetic syllable rhythm so the mouth can be previewed without audio. */
export function MabelGallery() {
  const [t, setT] = useState(0);
  useEffect(() => { let raf = 0; const f = (n: number) => { setT(n / 1000); raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf); }, []);
  const syllable = Math.max(0, Math.sin(t * 9.5)) * (0.55 + 0.45 * Math.sin(t * 2.3)) * 0.42;
  const cells: { label: string; state: MabelState; level?: number; shape?: number }[] = [
    { label: "Idle", state: "idle" }, { label: "Listening", state: "listening" }, { label: "Thinking", state: "thinking" },
    { label: "Speaking", state: "speaking", level: syllable, shape: 0.5 + 0.45 * Math.sin(t * 1.7) },
    { label: "Speaking — “oo”", state: "speaking", level: 0.38, shape: 0.04 }, { label: "Speaking — “ee”", state: "speaking", level: 0.38, shape: 0.96 },
  ];
  return (
    <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-3">
      {cells.map((c) => (
        <div key={c.label} className="card flex flex-col items-center p-5">
          <Mabel state={c.state} level={c.level} shape={c.shape} size={220} />
          <p className="mt-3 text-[13px] text-fg-2">{c.label}</p>
        </div>
      ))}
    </div>
  );
}
