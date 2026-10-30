"use client";
import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import clsx from "clsx";

export type MabelState = "idle" | "listening" | "thinking" | "speaking";

/**
 * Mabel — Hearth's companion: a warm woman in her forties, drawn as a
 * hand-built SVG.
 *
 * Animation model: every feature (mouth opening and shape, smile, brows,
 * gaze, eyelids, head tilt/nod, lean, breath) is a damped spring that chases a
 * target. Targets come from her state, the live voice meter (loudness + timbre)
 * and gentle procedural life (breathing, sway, glances, natural blinks). Springs
 * give continuous position *and* velocity, so nothing ever snaps, starts
 * abruptly or stops dead.
 */
type Key = "open" | "wide" | "smile" | "brow" | "lookX" | "lookY" | "lid" | "tilt" | "nod" | "lean" | "breath";
type Pose = Record<Key, number>;

// Natural frequency (rad/s) and damping ratio per feature.
const SPRING: Record<Key, [number, number]> = {
  open: [34, 0.85], wide: [18, 0.9], smile: [9, 0.95], brow: [12, 0.8], lookX: [16, 0.82], lookY: [16, 0.82],
  lid: [55, 1], tilt: [5, 0.62], nod: [9, 0.55], lean: [5, 0.85], breath: [6, 1],
};
const NEUTRAL: Pose = { open: 0, wide: 0.5, smile: 1, brow: 0, lookX: 0, lookY: 0, lid: 1, tilt: 0, nod: 0, lean: 0, breath: 0 };
const KEYS = Object.keys(NEUTRAL) as Key[];

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const upd = () => setR(m.matches || document.documentElement.classList.contains("reduce-motion"));
    upd(); m.addEventListener("change", upd);
    return () => m.removeEventListener("change", upd);
  }, []);
  return r;
}

function useMabelPose(state: MabelState, level: number, shape: number): Pose {
  const reduce = useReducedMotion();
  const [pose, setPose] = useState<Pose>(NEUTRAL);
  const input = useRef({ state, level, shape });
  input.current = { state, level, shape };

  useEffect(() => {
    const x: Pose = { ...NEUTRAL };
    const v: Pose = Object.fromEntries(KEYS.map((k) => [k, 0])) as Pose;
    // Procedural life: blink and glance schedules.
    let nextBlink = performance.now() + 1200, blinkUntil = 0, doubleBlink = false;
    let nextGlance = performance.now() + 2500, glance = { x: 0, y: 0 }, glanceUntil = 0;
    let raf = 0, last = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const { state: st, level: lv, shape: sh } = input.current;
      const talk = st === "speaking" ? Math.min(1, lv * 2.6) : 0;

      // Blinks: every 2.5–5.5 s, sometimes doubled; quicker while thinking.
      if (now > nextBlink) {
        blinkUntil = now + 110;
        nextBlink = now + (doubleBlink ? 3200 + Math.random() * 2600 : Math.random() < 0.18 ? 230 : 2500 + Math.random() * 3000);
        doubleBlink = !doubleBlink && nextBlink - now < 300;
      }
      // Glances: small saccades while idle/listening, returning to you.
      if (now > nextGlance) {
        glance = st === "idle" ? { x: (Math.random() - 0.5) * 5, y: (Math.random() - 0.6) * 2.4 } : { x: (Math.random() - 0.5) * 1.6, y: 0 };
        glanceUntil = now + 700 + Math.random() * 900;
        nextGlance = now + 3500 + Math.random() * 3500;
      }
      const g = now < glanceUntil ? glance : { x: 0, y: 0 };

      const target: Pose = {
        open: talk,
        wide: st === "speaking" ? sh : st === "thinking" ? 0.15 : 0.5,
        smile: st === "thinking" ? 0.25 : st === "speaking" ? 0.65 + 0.2 * (1 - talk) : st === "listening" ? 0.85 : 1,
        brow: st === "thinking" ? 1 : st === "listening" ? 0.55 : st === "speaking" ? 0.15 + Math.min(0.6, Math.max(0, talk - 0.45) * 1.4) : 0,
        lookX: st === "thinking" ? 2.4 + Math.sin(t * 0.9) * 0.7 : g.x,
        lookY: st === "thinking" ? -2.2 + Math.sin(t * 1.3) * 0.4 : g.y,
        lid: now < blinkUntil ? 0 : st === "listening" ? 1.08 : 1,
        tilt: (st === "listening" ? -3.2 : st === "thinking" ? 3.5 : 0) + Math.sin(t * 0.55) * 0.9 + (st === "speaking" ? Math.sin(t * 1.7) * 1.1 : 0),
        nod: st === "speaking" ? talk * 2.2 : st === "listening" ? Math.max(0, Math.sin(t * 2.2)) * 0.9 : 0,
        lean: st === "listening" ? 1 : st === "speaking" ? 0.35 : 0,
        breath: Math.sin(t * 1.35),
      };

      if (reduce) {
        // Respect Reduce Motion: no idle life, just the essential expression.
        for (const k of KEYS) x[k] = k === "breath" || k === "tilt" || k === "nod" || k === "lookX" || k === "lookY" ? 0 : target[k];
        x.lid = 1;
      } else {
        // Semi-implicit Euler with substeps: stable for stiff springs.
        const n = 3, h = dt / n;
        for (let i = 0; i < n; i++) {
          for (const k of KEYS) {
            const [w, z] = SPRING[k];
            v[k] += (w * w * (target[k] - x[k]) - 2 * z * w * v[k]) * h;
            x[k] += v[k] * h;
          }
        }
      }
      setPose({ ...x });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);
  return pose;
}

const HAIR = "#6b4430", HAIR_HI = "#9a6a4c", HAIR_LO = "#4a2c1f";

export function Mabel({ state = "idle", level = 0, shape = 0.5, size = 160, className }: { state?: MabelState; level?: number; shape?: number; size?: number; className?: string }) {
  const p = useMabelPose(state, level, shape);
  const o = Math.max(0, p.open);
  const lid = Math.min(1.1, Math.max(0, p.lid));

  const uid = useId().replace(/:/g, "");
  // Mouth geometry. Closed: a gentle smile. Open: width follows timbre
  // (round "oo" ≈ 5 ↔ wide "ee" ≈ 10.5), height follows loudness (taller for "oo").
  const wide = Math.min(1, Math.max(0, p.wide));
  const openAmt = Math.min(1, o * 2.2);
  const mw = 8.2 + ((4.9 + wide * 5.6) - 8.2) * openAmt;
  const smileLift = 2.2 * p.smile * (1 - openAmt * (1 - wide) * 0.8);
  const openH = o * (14 - wide * 5.5);
  const top = 125.5 - smileLift * 0.35;
  const corner = 125 - smileLift;
  // Outline through four points (corners, top-lip centre, bottom-lip centre). `rs` rounds the
  // corners continuously: 0 = crisp smile, ~0.55 = a true ellipse for "oo".
  const topY = (corner + top - 1.5 + smileLift * 0.2) / 2;
  const mouthBottom = top + 1.5 + smileLift * 0.4 + openH * 0.92;
  const rs = 0.55 * openAmt * (1 - wide * 0.75);
  const L = 100 - mw, R = 100 + mw, hx = mw * 0.56;
  const mouthD = `M${L} ${corner} C${L} ${corner - rs * (corner - topY)} ${100 - hx} ${topY} 100 ${topY} C${100 + hx} ${topY} ${R} ${corner - rs * (corner - topY)} ${R} ${corner} C${R} ${corner + rs * (mouthBottom - corner)} ${100 + hx} ${mouthBottom} 100 ${mouthBottom} C${100 - hx} ${mouthBottom} ${L} ${corner + rs * (mouthBottom - corner)} ${L} ${corner} Z`;

  // Eyes: the upper lid comes down over the eye (instead of squashing it).
  const eye = (cx: number, id: string) => (
    <g>
      <clipPath id={`${id}-${uid}`}><ellipse cx={cx} cy={103} rx={6.4} ry={5.4} /></clipPath>
      <ellipse cx={cx} cy={103} rx={6.4} ry={5.4} fill="#fffaf6" />
      <g clipPath={`url(#${id}-${uid})`}>
        <g transform={`translate(${p.lookX} ${p.lookY})`}>
          <circle cx={cx} cy={103} r={4.2} fill="#5a3b2a" />
          <circle cx={cx} cy={103} r={2.3} fill="#1f1512" />
          <circle cx={cx + 1.5} cy={101.4} r={1.25} fill="#fff" />
        </g>
        {/* eyelid */}
        <rect x={cx - 8} y={97.6 - 1} width={16} height={Math.max(0, (1 - lid) * 11.2) + 1} fill="#f3cdb5" />
      </g>
      {/* lash line follows the lid */}
      <path d={`M${cx - 6.8} ${103 - 5.2 * Math.max(0.15, lid) + 0.4} Q${cx} ${103 - 7.2 * Math.max(0.12, lid)} ${cx + 7} ${103 - 5.6 * Math.max(0.15, lid)}`} stroke="#2b1a14" strokeWidth={1.9} strokeLinecap="round" fill="none" />
      <path d={`M${cx + 6.2} ${103 - 4.6 * Math.max(0.15, lid)} l2.2 -1.4`} stroke="#2b1a14" strokeWidth={1.5} strokeLinecap="round" />
    </g>
  );

  return (
    <div className={clsx("relative inline-block select-none", className)} style={{ width: size, height: size }}>
      <AnimatePresence>
        {state === "listening" && (
          <motion.span key="ring" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-[3%] rounded-full" style={{ boxShadow: "0 0 0 5px color-mix(in srgb, var(--accent) 24%, transparent), 0 0 40px 6px color-mix(in srgb, var(--accent) 22%, transparent)" }} />
        )}
      </AnimatePresence>
      <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={`Mabel, ${state}`} className="relative">
        <defs>
          <radialGradient id="mb-bg" cx="50%" cy="36%" r="68%"><stop offset="0%" stopColor="#f2f3ff" /><stop offset="100%" stopColor="#d8dbfa" /></radialGradient>
          <linearGradient id="mb-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fbdcc6" /><stop offset="100%" stopColor="#efc2a6" /></linearGradient>
          <linearGradient id="mb-hair" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={HAIR_HI} /><stop offset="55%" stopColor={HAIR} /><stop offset="100%" stopColor={HAIR_LO} /></linearGradient>
          <radialGradient id="mb-blush" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#f58b8b" stopOpacity="0.5" /><stop offset="100%" stopColor="#f58b8b" stopOpacity="0" /></radialGradient>
          <linearGradient id="mb-cardi" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8a92f3" /><stop offset="100%" stopColor="#6f78e6" /></linearGradient>
          <clipPath id="mb-clip"><circle cx="100" cy="100" r="98" /></clipPath>
        </defs>
        <circle cx="100" cy="100" r="98" fill="url(#mb-bg)" />
        <g clipPath="url(#mb-clip)">
          <g transform={`translate(0 ${-p.lean * 2.5}) scale(${1 + p.lean * 0.018}) translate(${-p.lean * 1.8} 0)`} style={{ transformOrigin: "100px 200px" }}>
            {/* shoulders breathe */}
            <g transform={`translate(0 ${-p.breath * 0.9})`}>
              <path d="M30 214 C33 170 60 152 100 152 C140 152 167 170 170 214 Z" fill="url(#mb-cardi)" />
              <path d="M82 154 C88 165 112 165 118 154 C113 151 107 150 100 150 C93 150 87 151 82 154 Z" fill="#fff7f1" />
              <path d="M86 156 C90 166 110 166 114 156" stroke="#e7d6c9" strokeWidth="1" fill="none" />
              <circle cx="100" cy="166.5" r="2.4" fill="#f6e7c8" stroke="#d8c39a" strokeWidth="0.6" />
              <path d="M100 166 v-4" stroke="#d8c39a" strokeWidth="0.6" />
            </g>
            {/* head + neck move together: tilt around the neck, nod down a little */}
            <g transform={`translate(0 ${p.nod - p.breath * 0.5}) rotate(${p.tilt} 100 150)`}>
              {/* back hair: shoulder-length layered, curving up behind the neck */}
              <path d="M50 102 C46 60 72 38 101 38 C132 38 156 60 151 104 C150 126 156 140 150 152 C142 160 132 156 127 148 C120 136 80 136 73 148 C66 158 54 160 49 150 C44 138 51 124 50 102 Z" fill="url(#mb-hair)" />
              <path d="M89 130 h22 v24 c-6 5 -16 5 -22 0 Z" fill="#ecbb9d" />
              <path d="M90 140 q10 5 20 0" stroke="#dca386" strokeWidth="1.2" fill="none" opacity="0.6" />
              {/* face */}
              <path d="M58 98 C58 70 76 56 100 56 C124 56 142 70 142 98 C142 124 126 146 100 146 C74 146 58 124 58 98 Z" fill="url(#mb-skin)" />
              <ellipse cx="58.5" cy="105" rx="5.5" ry="7.5" fill="#efc0a3" />
              <ellipse cx="141.5" cy="105" rx="5.5" ry="7.5" fill="#efc0a3" />
              <circle cx="58" cy="114" r="2.1" fill="#f3d9a4" stroke="#caa86a" strokeWidth="0.5" />
              <circle cx="142" cy="114" r="2.1" fill="#f3d9a4" stroke="#caa86a" strokeWidth="0.5" />
              {/* side-parted fringe with a soft wave */}
              <path d="M57 100 C54 70 74 50 104 50 C126 50 145 64 145 92 C139 80 131 72 120 68 C112 80 92 84 70 84 C66 88 60 94 57 100 Z" fill="url(#mb-hair)" />
              <path d="M120 66 C114 78 98 84 78 84" stroke={HAIR_HI} strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.7" />
              <path d="M128 70 C134 76 139 84 142 94" stroke={HAIR_LO} strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.6" />
              {/* blush */}
              <ellipse cx="74" cy="119" rx="11" ry="7" fill="url(#mb-blush)" opacity={0.85 + o * 0.15} />
              <ellipse cx="126" cy="119" rx="11" ry="7" fill="url(#mb-blush)" opacity={0.85 + o * 0.15} />
              {/* brows (expressive, asymmetric when thinking) */}
              <path d="M75 92 Q83 87.5 91 90.5" transform={`translate(0 ${-p.brow * 2.6}) rotate(${-p.brow * 3} 83 90)`} stroke="#5b3a29" strokeWidth="2.6" strokeLinecap="round" fill="none" />
              <path d="M109 90.5 Q117 87.5 125 92" transform={`translate(0 ${-p.brow * (state === "thinking" ? 4 : 2.6)}) rotate(${p.brow * (state === "thinking" ? 7 : 3)} 117 90)`} stroke="#5b3a29" strokeWidth="2.6" strokeLinecap="round" fill="none" />
              {eye(84, "mb-eye-l")}
              {eye(116, "mb-eye-r")}
              {/* nose */}
              <path d="M98.5 108 C97.5 113 97 115 99 116 C100.5 116.6 102 116.3 103 115.6" stroke="#d99a7c" strokeWidth="1.8" strokeLinecap="round" fill="none" />
              {/* mouth: one continuously morphing shape — closed smile → round "oo" → wide "ee" */}
              <clipPath id={`mb-mouth-${uid}`}><path d={mouthD} /></clipPath>
              <path d={mouthD} fill={o > 0.04 ? "#7a3233" : "#c26b6b"} />
              {/* teeth and tongue live inside the mouth shape, so they can never poke out */}
              <g clipPath={`url(#mb-mouth-${uid})`}>
                <rect x={100 - mw} y={top - 3} width={mw * 2} height={2.6 + wide * 2.4} rx={1.2} fill="#fffaf6" opacity={Math.min(1, Math.max(0, (o - 0.12) * 4)) * (0.45 + wide * 0.55)} />
                <ellipse cx="100" cy={mouthBottom + 1.4} rx={mw * 0.62} ry={Math.max(0.1, openH * 0.32)} fill="#d9707a" opacity={Math.min(1, Math.max(0, (o - 0.25) * 3)) * (1 - wide * 0.55)} />
              </g>
              <path d={mouthD} fill="none" stroke="#b9575c" strokeWidth={1.6} strokeLinejoin="round" />
            </g>
          </g>
        </g>
      </svg>
      <AnimatePresence>
        {state === "thinking" && (
          <motion.span key="dots" initial={{ opacity: 0, y: 4, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -2, scale: 0.95 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-[2%] top-[10%] flex gap-1 rounded-full bg-elev px-2.5 py-2 shadow-md" style={{ border: "1px solid var(--line)" }} aria-hidden>
            {[0, 1, 2].map((i) => <span key={i} className="mabel-dot size-1.5 rounded-full bg-accent" style={{ animationDelay: `${i * 160}ms` }} />)}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}
