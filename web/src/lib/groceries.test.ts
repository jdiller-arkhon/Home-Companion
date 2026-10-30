import { describe, expect, it } from "vitest";
import { guessAisle, parseIngredient, regulars } from "./groceries";

const D = 86_400_000;

describe("groceries", () => {
  it("parses ingredient lines", () => {
    expect(parseIngredient("2 cups all-purpose flour")).toEqual({ name: "All-purpose flour", quantity: "2 cups" });
    expect(parseIngredient("- 1 ½ lb chicken thighs, boneless")).toEqual({ name: "Chicken thighs", quantity: "1 ½ lb" });
    expect(parseIngredient("Salt, to taste")).toEqual({ name: "Salt", quantity: "" });
    expect(parseIngredient("3 cloves garlic (minced)")).toEqual({ name: "Garlic", quantity: "3 cloves" });
    expect(parseIngredient("For the sauce:")).toBeNull();
  });

  it("guesses store sections", () => {
    expect(guessAisle("Oat milk")).toBe("Dairy");
    expect(guessAisle("Garlic")).toBe("Produce");
    expect(guessAisle("Dish soap")).toBe("Household");
  });

  it("learns purchase rhythm and suggests overdue regulars", () => {
    const now = 100 * D;
    const eggs = [60, 70, 80, 90].map((d) => ({ title: "Eggs", completedAt: d * D }));
    const milk = [70, 77, 84, 98].map((d) => ({ title: "Milk", completedAt: d * D }));
    const once = [{ title: "Saffron", completedAt: 10 * D }];
    expect(regulars([...eggs, ...milk, ...once], [], now)).toEqual([{ title: "Eggs", everyDays: 10, lastDaysAgo: 10 }]);
    expect(regulars(eggs, ["eggs"], now)).toEqual([]); // already on the list
  });
});
