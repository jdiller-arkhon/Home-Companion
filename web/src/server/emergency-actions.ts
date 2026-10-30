"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { audit } from "./audit";
import { saveEmergency } from "./emergency";

export async function saveCard(_: { ok?: boolean }, f: FormData): Promise<{ ok?: boolean }> {
  const u = await requireUser();
  const values = Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)]));
  const pw = String(f.get("wifi_password") ?? "");
  saveEmergency(values, f.get("clear_wifi") === "on" ? null : pw || undefined);
  audit({ actorId: u.id, actorKind: "user", action: "emergency:update", outcome: "ok" });
  revalidatePath("/emergency");
  return { ok: true };
}
