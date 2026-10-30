import { describe, expect, it } from "vitest";
import { parseCommand } from "./commands";

describe("spoken commands", () => {
  it.each([
    ["Add milk and eggs to the grocery list", { type: "add", kind: "grocery", items: ["milk", "eggs"] }],
    ["put oat milk, bananas & some coffee on our shopping list.", { type: "add", kind: "grocery", items: ["oat milk", "bananas", "coffee"] }],
    ["We're out of dish soap", { type: "add", kind: "grocery", items: ["dish soap"] }],
    ["remind me to call the plumber", { type: "add", kind: "task", items: ["call the plumber"] }],
    ["Hey Hearth, what's my day look like?", { type: "briefing", mode: "morning" }],
    ["I took out the trash", { type: "done", text: "trash" }],
    ["Goodnight", { type: "routine", name: "Goodnight" }],
    ["When does the car registration expire?", { type: "ask", text: "When does the car registration expire" }],
  ])("%s", (input, expected) => {
    expect(parseCommand(input, ["Goodnight", "Movie time"])).toEqual(expected);
  });
});
