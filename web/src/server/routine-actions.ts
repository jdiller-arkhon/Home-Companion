"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { audit } from "./audit";
import { saveRoutine, deleteRoutine, setEnabled, listRoutines, runRoutine } from "./routines";

export async function saveRoutineAction(input: unknown, id?: string): Promise<{ error?: string }> {
  const u = await requireUser();
  try {
    const r = saveRoutine(u.id, input, id);
    audit({ actorId: u.id, actorKind: "user", action: id ? "routine:update" : "routine:create", target: r.name, outcome: "ok" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg.startsWith("[") ? "Check the name, time, days and actions." : msg };
  }
  revalidatePath("/devices");
  return {};
}

export async function toggleRoutine(id: string, enabled: boolean) { await requireUser(); setEnabled(id, enabled); revalidatePath("/devices"); }
export async function removeRoutine(id: string) { const u = await requireUser(); deleteRoutine(id); audit({ actorId: u.id, actorKind: "user", action: "routine:delete", target: id, outcome: "ok" }); revalidatePath("/devices"); }
export async function runNow(id: string) {
  const u = await requireUser();
  const r = listRoutines().find((x) => x.id === id);
  if (!r) return "Not found";
  const msg = await runRoutine(r, u.id, "manual");
  revalidatePath("/devices");
  return msg;
}
