"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";

export type MabelState = "idle" | "listening" | "thinking" | "speaking";

/**
 * Mabel — Hearth's companion: a sweet, grandmotherly cartoon with a silver
 * bun, round glasses and pearls. Hand-built SVG so she's crisp at any size and cheap to animate. Her
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
  const mouthW = 8 + o * 2;
  const look = state === "thinking" ? { x: 3, y: -3 } : { x: 0, y: 0 };
  const eyeRy = blink ? 0.6 : state === "listening" ? 5.6 : 5;

  return (
    <div className={clsx("relative inline-block", className)} style={{ width: size, height: size }}>
      {state === "listening" && <span className="absolute inset-[4%] animate-ping rounded-full bg-accent/20" style={{ animationDuration: "1.6s" }} />}
      <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={`Mabel, ${state}`}
        className={clsx("relative overflow-visible transition-transform duration-500", state === "listening" && "-rotate-3")}>
        <defs>
          <radialGradient id="mb-bg" cx="50%" cy="38%" r="65%"><stop offset="0%" stopColor="#f1f2ff" /><stop offset="100%" stopColor="#dde0fb" /></radialGradient>
          <linearGradient id="mb-hair" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f3f3f7" /><stop offset="100%" stopColor="#c3c6d4" /></linearGradient>
          <linearGradient id="mb-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffe6d6" /><stop offset="100%" stopColor="#f6d0b9" /></linearGradient>
          <radialGradient id="mb-blush" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#ff8f9e" stopOpacity="0.6" /><stop offset="100%" stopColor="#ff8f9e" stopOpacity="0" /></radialGradient>
          <clipPath id="mb-clip"><circle cx="100" cy="100" r="98" /></clipPath>
        </defs>
        <circle cx="100" cy="100" r="98" fill="url(#mb-bg)" />
        <g clipPath="url(#mb-clip)">
          <g className="mabel-breathe">
            {/* cardigan, blouse collar, pearls */}
            <path d="M34 214 C36 170 62 150 100 150 C138 150 164 170 166 214 Z" fill="#7d86ef" />
            <path d="M80 152 L100 172 L120 152 C114 149 107 148 100 148 C93 148 86 149 80 152 Z" fill="#ffffff" />
            <path d="M84 156 Q100 176 116 156" stroke="none" fill="none" />
            {[-14, -9.5, -4.8, 0, 4.8, 9.5, 14].map((dx, i) => (
              <circle key={i} cx={100 + dx} cy={160 + Math.abs(dx) * -0.38 + 3.2} r="2.6" fill="#fffaf2" stroke="#e8e0d4" strokeWidth="0.6" />
            ))}
            {/* neck */}
            <path d="M89 134 h22 v18 c-6 4 -16 4 -22 0 Z" fill="#f0c4a8" />
            {/* back hair (soft silver) */}
            <path d="M52 100 C48 64 72 42 100 42 C128 42 152 64 148 100 C147 116 142 126 136 130 L64 130 C58 126 53 116 52 100 Z" fill="url(#mb-hair)" stroke="#b4b7c6" strokeWidth="1.2" />
            {/* bun */}
            <circle cx="100" cy="36" r="17" fill="url(#mb-hair)" stroke="#b4b7c6" strokeWidth="1.2" />
            <path d="M88 30 q12 -9 24 0" stroke="#c9ccd9" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            {/* face */}
            <ellipse cx="100" cy="102" rx="42" ry="44" fill="url(#mb-skin)" />
            {/* ears + pearl earrings */}
            <ellipse cx="59" cy="106" rx="6" ry="8" fill="#f4caae" />
            <ellipse cx="141" cy="106" rx="6" ry="8" fill="#f4caae" />
            <circle cx="58" cy="116" r="2.8" fill="#fffaf2" stroke="#e8e0d4" strokeWidth="0.6" />
            <circle cx="142" cy="116" r="2.8" fill="#fffaf2" stroke="#e8e0d4" strokeWidth="0.6" />
            {/* soft wavy fringe swept to the sides */}
            <path d="M58 92 C58 64 78 52 100 52 C122 52 142 64 142 92 C134 80 124 72 112 70 C106 76 94 76 88 70 C76 72 66 80 58 92 Z" fill="url(#mb-hair)" />
            <path d="M70 76 q10 -8 22 -6 M108 70 q12 -2 22 6" stroke="#c9ccd9" strokeWidth="1.4" fill="none" strokeLinecap="round" />
            {/* blush */}
            <ellipse cx="72" cy="120" rx="12" ry="8" fill="url(#mb-blush)" opacity={0.9 + o * 0.1} />
            <ellipse cx="128" cy="120" rx="12" ry="8" fill="url(#mb-blush)" opacity={0.9 + o * 0.1} />
            {/* gentle brows */}
            <path d={state === "thinking" ? "M76 86 q8 -5 15 -1" : "M76 88 q8 -3.5 15 0"} stroke="#b9bcc9" strokeWidth="2.6" strokeLinecap="round" fill="none" />
            <path d={state === "thinking" ? "M109 84 q8 -3 15 2" : "M109 88 q8 -3.5 15 0"} stroke="#b9bcc9" strokeWidth="2.6" strokeLinecap="round" fill="none" />
            {/* kind eyes */}
            <g style={{ transform: `translate(${look.x}px, ${look.y}px)`, transition: "transform 400ms cubic-bezier(.22,1,.36,1)" }}>
              <ellipse cx="84" cy="102" rx="4.6" ry={eyeRy} fill="#3a2a26" style={{ transition: "ry 90ms" }} />
              <ellipse cx="116" cy="102" rx="4.6" ry={eyeRy} fill="#3a2a26" style={{ transition: "ry 90ms" }} />
              {!blink && <><circle cx="85.8" cy="100" r="1.6" fill="#fff" /><circle cx="117.8" cy="100" r="1.6" fill="#fff" /></>}
            </g>
            {/* smile lines */}
            <path d="M68 100 q-3 3 -1 7 M132 100 q3 3 1 7" stroke="#e3ad94" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.8" />
            {/* round glasses */}
            <g stroke="#a98b74" strokeWidth="2.4" fill="#ffffff" fillOpacity="0.12">
              <circle cx="84" cy="102" r="12.5" />
              <circle cx="116" cy="102" r="12.5" />
              <path d="M96.5 101 q3.5 -3 7 0" fill="none" />
              <path d="M71.5 100 L61 97 M128.5 100 L139 97" fill="none" />
            </g>
            <path d="M77 95 l4 -3" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
            <path d="M109 95 l4 -3" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
            {/* nose */}
            <path d="M97 114 q3 3.5 6 0" stroke="#dfa287" strokeWidth="2" strokeLinecap="round" fill="none" />
            {/* mouth */}
            {o < 0.08 ? (
              <path d={state === "thinking" ? "M93 128 q7 2 14 -1" : "M89 125 q11 10 22 0"} stroke="#b35a5a" strokeWidth="2.8" strokeLinecap="round" fill="none" />
            ) : (
              <g>
                <path d={`M${100 - mouthW} 125 C${100 - mouthW} ${125 + mouthH * 1.3} ${100 + mouthW} ${125 + mouthH * 1.3} ${100 + mouthW} 125 Z`} fill="#7a3434" />
                {o > 0.3 && <ellipse cx="100" cy={125 + mouthH * 0.78} rx={mouthW * 0.5} ry={mouthH * 0.18} fill="#e57b80" />}
              </g>
            )}
          </g>
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
