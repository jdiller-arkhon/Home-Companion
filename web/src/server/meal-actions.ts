"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { audit } from "./audit";
import { recipeToGroceries } from "./meals";
import { createItem, parseInput } from "./items/repo";
import { publish } from "./events";

export async function sendRecipeToGroceries(id: string): Promise<string> {
  const u = await requireUser();
  const r = recipeToGroceries(u.id, id);
  audit({ actorId: u.id, actorKind: "user", action: "recipe:to_groceries", target: r.recipe, outcome: "ok", detail: { added: r.added.length } });
  revalidatePath("/planner");
  return r.added.length ? `Added ${r.added.length} item${r.added.length > 1 ? "s" : ""}${r.skipped.length ? ` (${r.skipped.length} already on the list)` : ""}.` : "Everything's already on the list.";
}

export async function quickAddGrocery(title: string) {
  const u = await requireUser();
  createItem(u.id, "grocery", parseInput("grocery", { title }));
  publish("items:grocery", u.id);
  revalidatePath("/planner");
}
