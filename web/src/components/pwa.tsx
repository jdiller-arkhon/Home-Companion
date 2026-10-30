"use client";
import { useEffect } from "react";

/** Registers the service worker and applies per-user appearance preferences. */
export function Pwa({ theme, reduceMotion }: { theme?: string; reduceMotion?: boolean }) {
  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    const el = document.documentElement;
    if (theme === "light" || theme === "dark") el.dataset.theme = theme; else delete el.dataset.theme;
    el.classList.toggle("reduce-motion", !!reduceMotion);
  }, [theme, reduceMotion]);
  return null;
}
