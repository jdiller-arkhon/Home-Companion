"use server";
import { revalidatePath } from "next/cache";
import { requireUser, isElevated } from "./auth";
import { audit } from "./audit";
import { publish } from "./events";
import { kindDef } from "./items/kinds";
import { completeItem, createItem, deleteItem, getItem, parseInput, setStatus, updateItem, ValidationError } from "./items/repo";

export type ItemFormState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };


function done(kind: string, userId: string) {
  publish(`items:${kind}`, userId);
  revalidatePath("/", "layout");
}

export async function saveItem(_: ItemFormState, form: FormData): Promise<ItemFormState> {
  const user = await requireUser();
  const kind = String(form.get("_kind"));
  const id = String(form.get("_id") ?? "");
  const visibility = form.get("_private") === "on" ? "private" : "shared";
  try {
    kindDef(kind);
    const raw = Object.fromEntries(form.entries());
    const input = parseInput(kind, raw);
    const item = id ? updateItem(user.id, id, input, visibility) : createItem(user.id, kind, input, { visibility });
    audit({ actorId: user.id, actorKind: "user", action: `${kind}:${id ? "update" : "create"}`, target: item.title, outcome: "ok" });
    done(kind, user.id);
    return { ok: true };
  } catch (e) {
    if (e instanceof ValidationError) return { error: e.message, fieldErrors: e.fieldErrors };
    return { error: e instanceof Error ? e.message : "Could not save" };
  }
}

export async function completeAction(id: string) {
  const user = await requireUser();
  const it = getItem(user.id, id);
  if (!it) throw new Error("Not found");
  const r = completeItem(user.id, id);
  audit({ actorId: user.id, actorKind: "user", action: `${it.kind}:complete`, target: it.title, outcome: "ok", detail: { rolledTo: r.rolledTo } });
  done(it.kind, user.id);
}

export async function statusAction(id: string, status: string) {
  const user = await requireUser();
  const it = setStatus(user.id, id, status);
  audit({ actorId: user.id, actorKind: "user", action: `${it.kind}:status`, target: it.title, outcome: "ok", detail: { status } });
  done(it.kind, user.id);
}

export async function deleteAction(id: string): Promise<{ error?: string; needsElevation?: boolean }> {
  const user = await requireUser();
  const it = getItem(user.id, id);
  if (!it) return { error: "Not found" };
  // Deleting history records is a sensitive action.
  if (it.kind === "repair" && !(await isElevated())) return { needsElevation: true };
  deleteItem(user.id, id);
  audit({ actorId: user.id, actorKind: "user", action: `${it.kind}:delete`, target: it.title, outcome: "ok" });
  done(it.kind, user.id);
  return {};
}
