import { z } from "zod";
import { db } from "./db/client";
import { newId } from "./ids";
import { audit } from "./audit";
import { getSettings } from "./settings";
import { callService, haConfigured, listDevices } from "./integrations/homeassistant";
import { notify } from "./notifications";
import { tzOffset } from "@/lib/time";

/**
 * Scheduled household routines ("Goodnight at 10:30 on weekdays when someone
 * is home"). Unattended routines may only perform actions that are safe
 * without a person present: they can lock but never unlock, close but never
 * open garage doors, and never touch alarms.
 */
export const Action = z.object({
  entity_id: z.string().regex(/^[a-z_]+\.[a-z0-9_]+$/),
  action: z.enum(["turn_on", "turn_off", "lock", "close", "set_temperature", "activate"]),
  value: z.number().min(40).max(95).optional(),
});
export const RoutineInput = z.object({
  name: z.string().trim().min(1).max(60),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  days: z.array(z.number().int().min(0).max(6)).min(1),
  presence: z.enum(["any", "home", "away"]),
  actions: z.array(Action).min(1).max(20),
});
export type RoutineInput = z.infer<typeof RoutineInput>;
export type Routine = RoutineInput & { id: string; owner_id: string; enabled: boolean; last_run: number | null; last_result: string | null };

const ALLOWED: Record<string, string[]> = {
  light: ["turn_on", "turn_off"], switch: ["turn_on", "turn_off"], fan: ["turn_on", "turn_off"], media_player: ["turn_off"],
  scene: ["activate"], script: ["activate"], lock: ["lock"], cover: ["close"], climate: ["set_temperature", "turn_off"], vacuum: ["turn_on"],
};

export function validateActions(actions: z.infer<typeof Action>[]) {
  for (const a of actions) {
    const domain = a.entity_id.split(".")[0];
    if (!ALLOWED[domain]?.includes(a.action)) throw new Error(`"${a.action}" on ${a.entity_id} isn't allowed in an unattended routine.`);
    if (a.action === "set_temperature" && a.value == null) throw new Error("Set a temperature.");
  }
}

type Row = Omit<Routine, "days" | "actions" | "enabled"> & { days: string; actions: string; enabled: number };
const toRoutine = (r: Row): Routine => ({ ...r, enabled: !!r.enabled, days: JSON.parse(r.days), actions: JSON.parse(r.actions) });

export function listRoutines(): Routine[] {
  return (db().prepare("SELECT * FROM routines ORDER BY time").all() as Row[]).map(toRoutine);
}

export function saveRoutine(ownerId: string, input: unknown, id?: string): Routine {
  const r = RoutineInput.parse(input);
  validateActions(r.actions);
  if (id) {
    db().prepare("UPDATE routines SET name=?, time=?, days=?, presence=?, actions=? WHERE id=?").run(r.name, r.time, JSON.stringify(r.days), r.presence, JSON.stringify(r.actions), id);
  } else {
    id = newId();
    db().prepare("INSERT INTO routines (id,owner_id,name,enabled,time,days,presence,actions,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(id, ownerId, r.name, 1, r.time, JSON.stringify(r.days), r.presence, JSON.stringify(r.actions), Date.now());
  }
  return toRoutine(db().prepare("SELECT * FROM routines WHERE id=?").get(id) as Row);
}

export function setEnabled(id: string, enabled: boolean) { db().prepare("UPDATE routines SET enabled=? WHERE id=?").run(enabled ? 1 : 0, id); }
export function deleteRoutine(id: string) { db().prepare("DELETE FROM routines WHERE id=?").run(id); }

async function someoneHome(): Promise<boolean | null> {
  const people = (await listDevices()).filter((d) => d.domain === "person");
  if (!people.length) return null;
  return people.some((p) => p.state === "home");
}

export async function runRoutine(r: Routine, actorId: string | null, reason: "schedule" | "manual", at = Date.now()): Promise<string> {
  validateActions(r.actions); // re-check in case rules tightened since saving
  if (r.presence !== "any") {
    const home = await someoneHome();
    if (home === null) return record(r, actorId, "skipped", "No person entities in Home Assistant to check presence.", reason, at);
    if ((r.presence === "home") !== home) return record(r, actorId, "skipped", r.presence === "home" ? "Nobody was home." : "Someone was home.", reason, at);
  }
  const failures: string[] = [];
  for (const a of r.actions) {
    const domain = a.entity_id.split(".")[0];
    const [d, s, data]: [string, string, Record<string, unknown>] =
      a.action === "activate" ? [domain, "turn_on", {}] :
      a.action === "close" ? ["cover", "close_cover", {}] :
      a.action === "set_temperature" ? ["climate", "set_temperature", { temperature: a.value }] :
      [domain, a.action, {}];
    try { await callService(d, s, { entity_id: a.entity_id, ...data }); } catch (e) { failures.push(`${a.entity_id}: ${(e as Error).message}`); }
  }
  const result = failures.length ? `${r.actions.length - failures.length}/${r.actions.length} actions succeeded. ${failures.join("; ")}` : `All ${r.actions.length} actions done.`;
  if (failures.length && reason === "schedule") await notify({ userId: null, category: "security", title: `Routine “${r.name}” had problems`, body: result, href: "/devices?tab=routines", dedupeKey: `routine-fail:${r.id}:${Math.floor(Date.now() / 60_000)}` });
  return record(r, actorId, failures.length ? "failed" : "ok", result, reason, at);
}

function record(r: Routine, actorId: string | null, outcome: "ok" | "failed" | "skipped", msg: string, reason: string, at: number) {
  db().prepare("UPDATE routines SET last_run=?, last_result=? WHERE id=?").run(at, `${outcome}: ${msg}`, r.id);
  audit({ actorId, actorKind: actorId ? "user" : "system", action: `routine:${reason}`, target: r.name, outcome: outcome === "skipped" ? "ok" : outcome, detail: { result: msg } });
  return msg;
}

/** Called every minute. Fires routines whose HH:MM matches the current household time. */
export async function tickRoutines(now = Date.now()) {
  if (!haConfigured()) return 0;
  const tz = getSettings().timezone;
  const local = new Date(now + tzOffset(now, tz));
  const hhmm = local.toISOString().slice(11, 16);
  const dow = local.getUTCDay();
  let ran = 0;
  for (const r of listRoutines()) {
    if (!r.enabled || r.time !== hhmm || !r.days.includes(dow)) continue;
    if (r.last_run && now - r.last_run < 90_000) continue; // never double-fire within the same minute
    await runRoutine(r, null, "schedule", now);
    ran++;
  }
  return ran;
}
