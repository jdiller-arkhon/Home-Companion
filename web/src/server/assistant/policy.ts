/**
 * Permission levels for anything the assistant can do. Reasoning (the model)
 * only ever *proposes*; this file and tools.ts decide what actually runs.
 *
 *  read      – no side effects; runs automatically
 *  low       – reversible household changes; runs automatically
 *  confirm   – a person must tap Approve in the UI
 *  elevated  – Approve + re-enter password/PIN (locks, alarms, garage, deletes, money)
 */
export type Level = "read" | "low" | "confirm" | "elevated";
export const LEVEL_ORDER: Record<Level, number> = { read: 0, low: 1, confirm: 2, elevated: 3 };

export function maxLevel(a: Level, b: Level): Level {
  return LEVEL_ORDER[a] >= LEVEL_ORDER[b] ? a : b;
}

/**
 * Taint escalation: once a turn has ingested untrusted text (document
 * contents, package emails, web data), any side-effecting tool call in that
 * turn is raised to at least `confirm`. A malicious PDF saying "add a bill"
 * or "unlock the door" therefore can never act silently.
 */
export function effectiveLevel(base: Level, opts: { tainted: boolean }): Level {
  if (opts.tainted && base !== "read") return maxLevel(base, "confirm");
  return base;
}

export function describeLevel(l: Level): string {
  return {
    read: "Reads information only",
    low: "Low-risk change, runs automatically",
    confirm: "Requires your approval",
    elevated: "Requires approval and your PIN or password",
  }[l];
}
