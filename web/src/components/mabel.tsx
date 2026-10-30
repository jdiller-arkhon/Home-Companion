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
  const mouthH = 1.5 + o * 13;
  const mouthW = 6 + o * 2.5;
  const look = state === "thinking" ? { x: 4, y: -5 } : state === "listening" ? { x: 0, y: 1 } : { x: 0, y: 0 };
  const eyeRy = blink ? 0.8 : state === "listening" ? 15 : 14;
  const tuft = state === "listening" ? "mabel-tuft-perk" : state === "speaking" ? "mabel-tuft-flicker" : "mabel-tuft-idle";

  return (
    <div className={clsx("relative inline-block", className)} style={{ width: size, height: size }}>
      {state === "listening" && <span className="absolute inset-[6%] animate-ping rounded-full bg-accent/20" style={{ animationDuration: "1.6s" }} />}
      <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={`Mabel, ${state}`} className="relative overflow-visible">
        <defs>
          <radialGradient id="mb-body" cx="38%" cy="28%" r="85%"><stop offset="0%" stopColor="#dfe2ff" /><stop offset="50%" stopColor="#b3b9ff" /><stop offset="100%" stopColor="#8f97f6" /></radialGradient>
          <radialGradient id="mb-belly" cx="50%" cy="35%" r="65%"><stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" /><stop offset="100%" stopColor="#f1f2ff" stopOpacity="0.55" /></radialGradient>
          <linearGradient id="mb-flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#ffa877" /><stop offset="55%" stopColor="#ffcf7a" /><stop offset="100%" stopColor="#fff0be" /></linearGradient>
          <radialGradient id="mb-blush" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ff8fb1" stopOpacity="0.75" /><stop offset="100%" stopColor="#ff8fb1" stopOpacity="0" /></radialGradient>
        </defs>
        {/* soft ground shadow */}
        <ellipse cx="100" cy="184" rx="44" ry="6.5" fill="#11111a" opacity="0.09" className="mabel-shadow" />
        <g className="mabel-bob">
          {/* tiny feet */}
          <ellipse cx="78" cy="176" rx="13" ry="7.5" fill="#8f97f6" />
          <ellipse cx="122" cy="176" rx="13" ry="7.5" fill="#8f97f6" />
          {/* round, squishy body (big head = cute) */}
          <path d="M100 42 C152 42 174 82 174 118 C174 158 144 178 100 178 C56 178 26 158 26 118 C26 82 48 42 100 42 Z" fill="url(#mb-body)" />
          {/* flame tuft with a little curl */}
          <g className={tuft} style={{ transformOrigin: "100px 46px" }}>
            <path d="M100 14 C112 24 118 34 113 44 C109 51 91 51 88 44 C84 35 90 30 96 26 C95 33 99 36 102 33 C105 29 103 20 100 14 Z" fill="url(#mb-flame)" />
            <ellipse cx="100" cy="41" rx="5" ry="5.5" fill="#fff6dc" opacity="0.9" />
          </g>
          {/* belly */}
          <ellipse cx="100" cy="151" rx="36" ry="23" fill="url(#mb-belly)" />
          {/* tiny heart on the belly */}
          <path d="M100 165 C93 160 93 154 97.5 153 C99 152.6 100 154 100 155.3 C100 154 101 152.6 102.5 153 C107 154 107 160 100 165 Z" fill="#ff9fbf" opacity="0.75" />
          {/* stubby arms */}
          <ellipse cx="30" cy="132" rx="9" ry="12" fill="#97a0f8" className={state === "speaking" ? "mabel-wave-l" : undefined} style={{ transformOrigin: "36px 124px" }} />
          <ellipse cx="170" cy="132" rx="9" ry="12" fill="#97a0f8" className={state === "speaking" ? "mabel-wave-r" : undefined} style={{ transformOrigin: "164px 124px" }} />
          {/* gloss */}
          <ellipse cx="66" cy="70" rx="15" ry="8" fill="#ffffff" opacity="0.45" transform="rotate(-28 66 70)" />
          <circle cx="86" cy="58" r="3" fill="#ffffff" opacity="0.5" />
          {/* big sparkly eyes, set low and wide */}
          <g style={{ transform: `translate(${look.x}px, ${look.y}px)`, transition: "transform 420ms cubic-bezier(.22,1,.36,1)" }}>
            <ellipse cx="74" cy="110" rx="12" ry={eyeRy} fill="#211d3d" style={{ transition: "ry 90ms" }} />
            <ellipse cx="126" cy="110" rx="12" ry={eyeRy} fill="#211d3d" style={{ transition: "ry 90ms" }} />
            {!blink && <>
              <circle cx="79" cy="103" r="5" fill="#fff" /><circle cx="131" cy="103" r="5" fill="#fff" />
              <circle cx="69" cy="117" r="2.4" fill="#fff" opacity="0.9" /><circle cx="121" cy="117" r="2.4" fill="#fff" opacity="0.9" />
              <path d="M71 121 q3 2 7 0" stroke="#7c84ee" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.7" />
              <path d="M123 121 q3 2 7 0" stroke="#7c84ee" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.7" />
            </>}
          </g>
          {/* soft blush */}
          <ellipse cx="54" cy="130" rx="14" ry="9" fill="url(#mb-blush)" opacity={0.85 + o * 0.15} />
          <ellipse cx="146" cy="130" rx="14" ry="9" fill="url(#mb-blush)" opacity={0.85 + o * 0.15} />
          {/* little mouth */}
          {o < 0.08 ? (
            state === "thinking"
              ? <path d="M95 132 q5 1.5 10 -1" stroke="#211d3d" strokeWidth="2.6" strokeLinecap="round" fill="none" />
              : <path d="M93 129 q3.5 4.5 7 0 q3.5 4.5 7 0" stroke="#211d3d" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          ) : (
            <g>
              <path d={`M${100 - mouthW} 128 C${100 - mouthW} ${128 + mouthH * 1.3} ${100 + mouthW} ${128 + mouthH * 1.3} ${100 + mouthW} 128 Z`} fill="#3a1f3a" />
              {o > 0.3 && <ellipse cx="100" cy={128 + mouthH * 0.78} rx={mouthW * 0.5} ry={mouthH * 0.18} fill="#ff7a93" />}
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
