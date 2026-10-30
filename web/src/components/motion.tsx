"use client";
import { MotionConfig, motion } from "motion/react";

/** Shared spring + easing tokens so every animation in Hearth feels like one system. */
export const spring = { type: "spring", stiffness: 520, damping: 42, mass: 0.9 } as const;
export const soft = { type: "spring", stiffness: 300, damping: 34 } as const;
export const ease = [0.22, 1, 0.36, 1] as const;

export function MotionRoot({ reduce, children }: { reduce?: boolean; children: React.ReactNode }) {
  return <MotionConfig reducedMotion={reduce ? "always" : "user"} transition={soft}>{children}</MotionConfig>;
}

/** Page-level enter animation; template.tsx remounts it on every navigation. */
export function PageEnter({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.38, ease }} style={{ willChange: "transform, opacity" }}>
      {children}
    </motion.div>
  );
}
