"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { audit } from "./audit";
import { publish } from "./events";
import { parseCsv, parseOfx, importStatement } from "./bank-import";

export async function importBankFile(_: { message?: string; error?: string }, f: FormData): Promise<{ message?: string; error?: string }> {
  const user = await requireUser();
  const file = f.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose a file downloaded from online banking." };
  if (file.size > 10 * 1024 * 1024) return { error: "That file is too large (10 MB max)." };
  const text = await file.text();
  try {
    const isOfx = /<OFX>/i.test(text) || /\.(ofx|qfx|qbo)$/i.test(file.name);
    const st = isOfx ? parseOfx(text) : parseCsv(text);
    if (!st.txns.length && !st.account) return { error: "No transactions found in that file." };
    const r = importStatement(user.id, st, { visibility: f.get("private") === "on" ? "private" : "shared", accountName: String(f.get("account") ?? "").trim() || undefined });
    audit({ actorId: user.id, actorKind: "user", action: "finance:import", target: file.name, outcome: "ok", detail: r });
    publish("items:expense", user.id);
    revalidatePath("/finance");
    return { message: `Imported ${r.added} transaction${r.added === 1 ? "" : "s"}${r.skipped ? `, skipped ${r.skipped} already imported` : ""}${r.balanceUpdated ? ", updated the balance" : ""}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't read that file." };
  }
}
