/** Structured JSON logging to stdout (collected by Docker / journald). */
type Level = "debug" | "info" | "warn" | "error";
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const min = order[(process.env.HEARTH_LOG_LEVEL as Level) ?? "info"] ?? 20;

const ring: { ts: number; level: Level; msg: string; ctx?: unknown }[] = [];

function write(level: Level, msg: string, ctx?: Record<string, unknown>) {
  if (order[level] < min) return;
  const entry = { ts: Date.now(), level, msg, ctx };
  if (level === "warn" || level === "error") {
    ring.push(entry);
    if (ring.length > 200) ring.shift();
  }
  if (process.env.VITEST) return;
  const line = JSON.stringify({ t: new Date(entry.ts).toISOString(), level, msg, ...ctx });
  (level === "error" ? console.error : console.log)(line);
}

export const log = {
  debug: (m: string, c?: Record<string, unknown>) => write("debug", m, c),
  info: (m: string, c?: Record<string, unknown>) => write("info", m, c),
  warn: (m: string, c?: Record<string, unknown>) => write("warn", m, c),
  error: (m: string, c?: Record<string, unknown>) => write("error", m, c),
  recentProblems: () => [...ring].reverse(),
};
