"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";

export type MabelState = "idle" | "listening" | "thinking" | "speaking";

/**
 * Mabel — Hearth's companion mascot: a soft little hearth-spirit with a flame
 * tuft. Hand-built SVG so she's crisp at any size and cheap to animate. Her
 * mouth follows the live loudness of her voice (voice.ts → onLevel).
 */
export function Mabel({ state = "idle", level = 0, size = 160, className }: { state?: MabelState; level?: number; size?: number; className?: string }) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = () => { t = setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 130); loop(); }, 2000 + Math.random() * 3500); };
    loop();
    return () => clearTimeout(t);
  }, []);

  const o = state === "speaking" ? Math.min(1, level * 2.6) : 0;
  const mouthH = 2 + o * 18;
  const mouthW = 8 + o * 3;
  const look = state === "thinking" ? { x: 4, y: -5 } : state === "listening" ? { x: 0, y: 1 } : { x: 0, y: 0 };
  const eyeRy = blink ? 0.8 : state === "listening" ? 12.5 : 11;
  const tuft = state === "listening" ? "mabel-tuft-perk" : state === "speaking" ? "mabel-tuft-flicker" : "mabel-tuft-idle";

  return (
    <div className={clsx("relative inline-block", className)} style={{ width: size, height: size }}>
      {state === "listening" && <span className="absolute inset-[6%] animate-ping rounded-full bg-accent/20" style={{ animationDuration: "1.6s" }} />}
      <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={`Mabel, ${state}`} className="relative overflow-visible">
        <defs>
          <radialGradient id="mb-body" cx="40%" cy="30%" r="80%"><stop offset="0%" stopColor="#c7ccff" /><stop offset="55%" stopColor="#9aa2ff" /><stop offset="100%" stopColor="#7c84ee" /></radialGradient>
          <radialGradient id="mb-belly" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" /><stop offset="100%" stopColor="#eef0ff" stopOpacity="0.5" /></radialGradient>
          <linearGradient id="mb-flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#ff9f6b" /><stop offset="60%" stopColor="#ffc36b" /><stop offset="100%" stopColor="#ffe6a6" /></linearGradient>
        </defs>
        {/* soft ground shadow */}
        <ellipse cx="100" cy="186" rx={state === "speaking" ? 46 : 50} ry="7" fill="#11111a" opacity="0.10" className="mabel-shadow" />
        <g className="mabel-bob">
          {/* flame tuft */}
          <g className={tuft} style={{ transformOrigin: "100px 52px" }}>
            <path d="M100 18 C110 32 116 40 112 52 C109 60 91 60 88 52 C85 44 92 34 100 18 Z" fill="url(#mb-flame)" />
            <path d="M100 34 C105 41 107 46 105 52 C103 56 97 56 95 52 C94 47 97 41 100 34 Z" fill="#fff4d6" opacity="0.9" />
          </g>
          {/* body: a soft gumdrop */}
          <path d="M100 48 C146 48 168 86 168 126 C168 164 140 180 100 180 C60 180 32 164 32 126 C32 86 54 48 100 48 Z" fill="url(#mb-body)" />
          {/* belly patch */}
          <ellipse cx="100" cy="146" rx="40" ry="28" fill="url(#mb-belly)" />
          {/* little arms */}
          <path d="M36 128 C24 132 22 146 32 150" stroke="#7c84ee" strokeWidth="10" strokeLinecap="round" fill="none" className={state === "speaking" ? "mabel-wave-l" : undefined} style={{ transformOrigin: "36px 128px" }} />
          <path d="M164 128 C176 132 178 146 168 150" stroke="#7c84ee" strokeWidth="10" strokeLinecap="round" fill="none" className={state === "speaking" ? "mabel-wave-r" : undefined} style={{ transformOrigin: "164px 128px" }} />
          {/* gloss */}
          <ellipse cx="72" cy="78" rx="14" ry="8" fill="#ffffff" opacity="0.35" transform="rotate(-25 72 78)" />
          {/* eyes */}
          <g style={{ transform: `translate(${look.x}px, ${look.y}px)`, transition: "transform 420ms cubic-bezier(.22,1,.36,1)" }}>
            <ellipse cx="80" cy="104" rx="9.5" ry={eyeRy} fill="#1f1d3a" style={{ transition: "ry 90ms" }} />
            <ellipse cx="120" cy="104" rx="9.5" ry={eyeRy} fill="#1f1d3a" style={{ transition: "ry 90ms" }} />
            {!blink && <>
              <circle cx="84" cy="98" r="3.4" fill="#fff" /><circle cx="124" cy="98" r="3.4" fill="#fff" />
              <circle cx="77" cy="109" r="1.6" fill="#fff" opacity="0.8" /><circle cx="117" cy="109" r="1.6" fill="#fff" opacity="0.8" />
            </>}
          </g>
          {/* cheeks */}
          <ellipse cx="62" cy="122" rx="9" ry="5.5" fill="#ff8fb1" opacity={0.45 + o * 0.2} />
          <ellipse cx="138" cy="122" rx="9" ry="5.5" fill="#ff8fb1" opacity={0.45 + o * 0.2} />
          {/* mouth */}
          {o < 0.08 ? (
            <path d={state === "thinking" ? "M93 126 q7 2 14 -1" : "M91 123 q9 9 18 0"} stroke="#1f1d3a" strokeWidth="3" strokeLinecap="round" fill="none" />
          ) : (
            <g>
              {/* rounded “D” mouth; its lowest point is 121 + mouthH */}
              <path d={`M${100 - mouthW} 120 C${100 - mouthW} ${120 + mouthH * 1.3} ${100 + mouthW} ${120 + mouthH * 1.3} ${100 + mouthW} 120 Z`} fill="#3a1f3a" />
              {o > 0.3 && <ellipse cx="100" cy={120 + mouthH * 0.78} rx={mouthW * 0.5} ry={mouthH * 0.18} fill="#ff7a93" />}
            </g>
          )}
        </g>
      </svg>
      {state === "thinking" && (
        <span className="absolute -right-1 top-[14%] flex gap-1 rounded-full bg-elev px-2 py-1.5 shadow-md" style={{ border: "1px solid var(--line)" }} aria-hidden>
          {[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-bounce rounded-full bg-accent" style={{ animationDelay: `${i * 120}ms` }} />)}
        </span>
      )}
    </div>
  );
}
