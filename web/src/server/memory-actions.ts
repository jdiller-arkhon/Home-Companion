"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { addMemory, deleteMemory } from "./assistant/memory";
import { deleteConversation } from "./assistant/conversations";

export async function forget(id: string) { const u = await requireUser(); deleteMemory(u.id, id); revalidatePath("/assistant"); }
export async function teach(fact: string, household: boolean) {
  const u = await requireUser();
  if (fact.trim().length < 3) return;
  addMemory(household ? null : u.id, fact.slice(0, 500), "user");
  revalidatePath("/assistant");
}
export async function removeConversation(id: string) { const u = await requireUser(); deleteConversation(u.id, id); revalidatePath("/assistant"); }
