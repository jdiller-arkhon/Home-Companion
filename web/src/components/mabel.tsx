"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";

export type MabelState = "idle" | "listening" | "thinking" | "speaking";

type Pose = { open: number; smile: number; brow: number; lookX: number; lookY: number; lid: number; tilt: number };

/**
 * Every facial feature is a continuous value that eases toward its target each
 * frame (frame-rate independent exponential smoothing, per-feature speed), so
 * Mabel never snaps between poses — mouth, brows, eyes, blinks and head tilt
 * all glide. Attribute changes are rendered directly, so it works the same on
 * Safari, Chrome and the Pi's Chromium.
 */
const SPEED: Record<keyof Pose, number> = { open: 28, smile: 9, brow: 8, lookX: 7, lookY: 7, lid: 30, tilt: 6 };

const NEUTRAL: Pose = { open: 0, smile: 1, brow: 0, lookX: 0, lookY: 0, lid: 1, tilt: 0 };

function usePose(target: Pose, reduce: boolean): Pose {
  // Start neutral and ease into the current expression, even on first mount.
  const [pose, setPose] = useState(NEUTRAL);
  const cur = useRef({ ...NEUTRAL });
  const tgt = useRef(target);
  tgt.current = target;
  useEffect(() => {
    if (reduce) { cur.current = { ...tgt.current }; setPose(cur.current); return; }
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let moving = false;
      const next = { ...cur.current };
      for (const k of Object.keys(SPEED) as (keyof Pose)[]) {
        const d = tgt.current[k] - next[k];
        if (Math.abs(d) > 0.0005) { next[k] += d * (1 - Math.exp(-SPEED[k] * dt)); moving = true; } else next[k] = tgt.current[k];
      }
      cur.current = next;
      if (moving) setPose(next);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);
  return reduce ? target : pose;
}

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

  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const upd = () => setReduce(m.matches || document.documentElement.classList.contains("reduce-motion"));
    upd(); m.addEventListener("change", upd);
    return () => m.removeEventListener("change", upd);
  }, []);
  const p = usePose({
    open: state === "speaking" ? Math.min(1, level * 2.6) : 0,
    smile: state === "thinking" ? 0.15 : state === "speaking" ? 0.7 : 1,
    brow: state === "thinking" ? 1 : state === "listening" ? 0.5 : 0,
    lookX: state === "thinking" ? 3 : 0,
    lookY: state === "thinking" ? -3 : state === "listening" ? 0.5 : 0,
    lid: blink ? 0.08 : state === "listening" ? 1.1 : 1,
    tilt: state === "listening" ? -4 : state === "thinking" ? 2 : 0,
  }, reduce);
  const o = p.open;
  // One continuous mouth shape: a smile crescent that opens into a rounded "D".
  const mw = 9 + o * 1.5 - (1 - p.smile) * 2;
  const bend = 1 + p.smile * 5;            // smile curvature of the top lip
  const drop = 2.2 + p.smile * 2.5 + o * 15; // bottom lip depth

  return (
    <div className={clsx("relative inline-block", className)} style={{ width: size, height: size }}>
      <AnimatePresence>
        {state === "listening" && (
          <motion.span key="ring" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.35 }}
            className="absolute inset-[4%] rounded-full" style={{ boxShadow: "0 0 0 6px color-mix(in srgb, var(--accent) 22%, transparent)" }}>
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/15" style={{ animationDuration: "1.8s" }} />
          </motion.span>
        )}
      </AnimatePresence>
      <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={`Mabel, ${state}`}
        className="relative overflow-visible" style={{ transform: `rotate(${p.tilt}deg)`, transformOrigin: "50% 75%" }}>
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
            <path d="M76 88 q8 -3.5 15 0" transform={`translate(0 ${-p.brow * 2.2}) rotate(${-p.brow * 4} 83 87)`} stroke="#b9bcc9" strokeWidth="2.6" strokeLinecap="round" fill="none" />
            <path d="M109 88 q8 -3.5 15 0" transform={`translate(0 ${-p.brow * 3}) rotate(${p.brow * 7} 116 87)`} stroke="#b9bcc9" strokeWidth="2.6" strokeLinecap="round" fill="none" />
            {/* kind eyes */}
            <g transform={`translate(${p.lookX} ${p.lookY})`}>
              <ellipse cx="84" cy="102" rx="4.6" ry={Math.max(0.5, 5 * p.lid)} fill="#3a2a26" />
              <ellipse cx="116" cy="102" rx="4.6" ry={Math.max(0.5, 5 * p.lid)} fill="#3a2a26" />
              <circle cx="85.8" cy="100" r="1.6" fill="#fff" opacity={Math.max(0, Math.min(1, (p.lid - 0.4) / 0.4))} />
              <circle cx="117.8" cy="100" r="1.6" fill="#fff" opacity={Math.max(0, Math.min(1, (p.lid - 0.4) / 0.4))} />
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
            {/* mouth: one shape whose curves morph continuously */}
            <path d={`M${100 - mw} 124 Q100 ${124 + bend} ${100 + mw} 124 Q100 ${124 + drop * 1.9} ${100 - mw} 124 Z`}
              fill="#7a3434" stroke="#b35a5a" strokeWidth={2.4 - o * 1.2} strokeLinejoin="round" />
            <ellipse cx="100" cy={124 + drop * 0.72} rx={mw * 0.5} ry={Math.max(0, (drop - 6) * 0.22)} fill="#e57b80" opacity={Math.min(1, Math.max(0, (o - 0.25) * 3))} />
          </g>
        </g>
      </svg>
      <AnimatePresence>
        {state === "thinking" && (
          <motion.span key="dots" initial={{ opacity: 0, y: 4, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -2, scale: 0.95 }} transition={{ duration: 0.25 }}
            className="absolute -right-1 top-[14%] flex gap-1 rounded-full bg-elev px-2 py-1.5 shadow-md" style={{ border: "1px solid var(--line)" }} aria-hidden>
            {[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-bounce rounded-full bg-accent" style={{ animationDelay: `${i * 120}ms` }} />)}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
