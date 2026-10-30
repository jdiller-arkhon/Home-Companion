"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { audit } from "./audit";
import { addExternal, removeExternal, syncExternal } from "./calendar";

export async function addCalendar(_: { error?: string; ok?: boolean }, f: FormData): Promise<{ error?: string; ok?: boolean }> {
  const u = await requireUser();
  try {
    const id = addExternal(u.id, String(f.get("name") ?? ""), String(f.get("url") ?? ""), f.get("shared") === "on");
    await syncExternal(id);
    audit({ actorId: u.id, actorKind: "user", action: "calendar:subscribe", target: String(f.get("name") ?? ""), outcome: "ok" });
  } catch (e) { return { error: e instanceof Error ? e.message : "Invalid address" }; }
  revalidatePath("/settings");
  return { ok: true };
}

export async function removeCalendar(id: string) { const u = await requireUser(); removeExternal(u.id, id); revalidatePath("/settings"); }
export async function syncNow(id: string) { await requireUser(); await syncExternal(id); revalidatePath("/settings"); }
