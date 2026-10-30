import { createItem, getItem, listItems, parseInput } from "./items/repo";
import { parseIngredient, norm } from "@/lib/groceries";
import { publish } from "./events";

/** Adds a recipe's ingredients to the grocery list, skipping anything already on it. */
export function recipeToGroceries(userId: string, recipeId: string) {
  const r = getItem(userId, recipeId);
  if (!r || r.kind !== "recipe") throw new Error("Recipe not found");
  const open = new Set(listItems(userId, { kind: "grocery", status: "open" }).map((g) => norm(g.title)));
  const added: string[] = [], skipped: string[] = [];
  for (const line of String(r.data.ingredients ?? "").split(/\r?\n/)) {
    const ing = parseIngredient(line);
    if (!ing) continue;
    if (open.has(norm(ing.name)) || /^(salt|pepper|water|black pepper)$/i.test(ing.name)) { skipped.push(ing.name); continue; }
    createItem(userId, "grocery", parseInput("grocery", { title: ing.name, quantity: ing.quantity }));
    open.add(norm(ing.name));
    added.push(ing.name);
  }
  if (added.length) publish("items:grocery", userId);
  return { recipe: r.title, added, skipped };
}
