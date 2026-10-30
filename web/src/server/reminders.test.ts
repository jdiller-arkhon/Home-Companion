import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./push", () => ({ sendPush: vi.fn() }));
import { openDatabase, useDatabaseForTests, db } from "./db/client";
import { createItem, parseInput } from "./items/repo";
import { sweepReminders } from "./reminders";
import { inbox, markAllRead, unreadCount } from "./notifications";
import { updateSettings } from "./settings";

beforeEach(() => {
  useDatabaseForTests(openDatabase(":memory:"));
  db().prepare("INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES ('a','Alex','a@h','x','admin',1),('b','Sam','s@h','x','member',2)").run();
  updateSettings({ timezone: "UTC", morning_briefing_hour: 4 });
});

const NOW = Date.UTC(2026, 10, 2, 15); // 3 PM, outside briefing hours

describe("reminder sweep", () => {
  it("notifies once per maintenance cycle and respects privacy", async () => {
    createItem("a", "maintenance", parseInput("maintenance", { title: "Furnace filter", due_at: "2026-11-04", recurrence: "quarterly" }, "UTC"));
    createItem("a", "task", parseInput("task", { title: "Secret gift", due_at: "2026-11-02" }, "UTC"), { visibility: "private" });
    expect(await sweepReminders(NOW)).toBe(3); // maintenance ×2 people + private task ×1
    expect(await sweepReminders(NOW)).toBe(0); // idempotent
    expect(inbox("b").map((n) => n.title)).toEqual(["Furnace filter is due in 2 days"]);
    expect(inbox("a").some((n) => n.title.startsWith("Secret gift"))).toBe(true);
  });

  it("tracks read state per person", async () => {
    createItem("a", "package", parseInput("package", { title: "Lamp", due_at: "2026-11-02" }, "UTC"));
    await sweepReminders(NOW);
    expect(inbox("a").map((n) => n.title)).toEqual(["Lamp arrives today"]);
    markAllRead("a");
    expect(unreadCount("a")).toBe(0);
    expect(unreadCount("b")).toBe(1);
  });
});
