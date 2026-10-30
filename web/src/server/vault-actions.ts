"use server";
import { revalidatePath } from "next/cache";
import { requireUser, isElevated } from "./auth";
import { audit } from "./audit";
import { storeDoc, deleteDoc, updateDoc } from "./vault";
import { parseDateOnly } from "@/lib/time";

export async function uploadDocs(_: { error?: string; ok?: boolean }, f: FormData): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  const files = f.getAll("files").filter((x): x is File => x instanceof File && x.size > 0);
  if (!files.length) return { error: "Choose at least one file." };
  const exp = String(f.get("expires") ?? "");
  try {
    for (const file of files) {
      const id = await storeDoc(user.id, { name: file.name, type: file.type, bytes: Buffer.from(await file.arrayBuffer()) },
        { folder: String(f.get("folder") ?? ""), visibility: f.get("shared") === "on" ? "shared" : "private", expiresAt: exp ? parseDateOnly(exp) : null });
      audit({ actorId: user.id, actorKind: "user", action: "vault:upload", target: file.name, outcome: "ok", detail: { id } });
    }
  } catch (e) { return { error: e instanceof Error ? e.message : "Upload failed" }; }
  revalidatePath("/vault");
  return { ok: true };
}

export async function removeDoc(id: string): Promise<{ needsElevation?: boolean; error?: string }> {
  const user = await requireUser();
  if (!(await isElevated())) return { needsElevation: true };
  try {
    const d = deleteDoc(user.id, id);
    audit({ actorId: user.id, actorKind: "user", action: "vault:delete", target: d.name, outcome: "ok" });
  } catch (e) { return { error: (e as Error).message }; }
  revalidatePath("/vault");
  return {};
}

export async function shareDoc(id: string, shared: boolean) {
  const user = await requireUser();
  updateDoc(user.id, id, { visibility: shared ? "shared" : "private" });
  audit({ actorId: user.id, actorKind: "user", action: "vault:visibility", target: id, outcome: "ok", detail: { shared } });
  revalidatePath("/vault");
}
