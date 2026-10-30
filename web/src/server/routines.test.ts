import { beforeEach, describe, expect, it, vi } from "vitest";
const calls: unknown[] = [];
const people = { alex: "not_home", sun: "below_horizon" };
vi.mock("./integrations/homeassistant", () => ({
  haConfigured: () => true,
  callService: vi.fn(async (...a: unknown[]) => { calls.push(a); return []; }),
  listDevices: vi.fn(async () => [{ id: "person.alex", domain: "person", state: people.alex }, { id: "sun.sun", domain: "sun", state: people.sun }]),
}));
vi.mock("./push", () => ({ sendPush: vi.fn() }));
import { openDatabase, useDatabaseForTests, db } from "./db/client";
import { saveRoutine, tickRoutines, listRoutines } from "./routines";
import { updateSettings } from "./settings";

beforeEach(() => {
  calls.length = 0;
  people.alex = "not_home";
  globalThis.__hearthHomeCount = undefined;
  useDatabaseForTests(openDatabase(":memory:"));
  db().prepare("INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES ('a','Alex','a@h','x','admin',1)").run();
  updateSettings({ timezone: "UTC" });
});

const base = { name: "Goodnight", time: "22:30", days: [1, 2, 3, 4, 5], presence: "any" as const };

describe("routines", () => {
  it("refuses unsafe unattended actions", () => {
    expect(() => saveRoutine("a", { ...base, actions: [{ entity_id: "lock.front", action: "unlock" }] })).toThrow();
    expect(() => saveRoutine("a", { ...base, actions: [{ entity_id: "cover.garage", action: "open" }] })).toThrow();
    expect(() => saveRoutine("a", { ...base, actions: [{ entity_id: "alarm_control_panel.home", action: "turn_off" }] })).toThrow(/isn't allowed/);
  });

  it("fires at the scheduled minute on the right days, once", async () => {
    saveRoutine("a", { ...base, actions: [{ entity_id: "lock.front", action: "lock" }, { entity_id: "light.porch", action: "turn_off" }] });
    const mon2230 = Date.UTC(2026, 10, 2, 22, 30, 5); // Monday
    expect(await tickRoutines(mon2230 - 60_000)).toBe(0);
    expect(await tickRoutines(mon2230)).toBe(1);
    expect(await tickRoutines(mon2230 + 20_000)).toBe(0);
    expect(calls).toHaveLength(2);
    expect(await tickRoutines(Date.UTC(2026, 10, 1, 22, 30))).toBe(0); // Sunday
  });

  it("skips when the presence condition isn't met", async () => {
    saveRoutine("a", { ...base, presence: "home", actions: [{ entity_id: "light.porch", action: "turn_on" }] });
    await tickRoutines(Date.UTC(2026, 10, 2, 22, 30));
    expect(calls).toHaveLength(0);
    expect(listRoutines()[0].last_result).toMatch(/skipped: Nobody was home/);
  });

  it("fires arrival routines on the first person home, only after dark", async () => {
    saveRoutine("a", { ...base, name: "Welcome", trigger: "first_arrives", after_dark: true, actions: [{ entity_id: "light.porch", action: "turn_on" }] });
    const t = Date.UTC(2026, 10, 2, 18, 0);
    await tickRoutines(t);                       // baseline: nobody home
    expect(calls).toHaveLength(0);
    people.alex = "home";
    expect(await tickRoutines(t + 60_000)).toBe(1);
    expect(calls).toHaveLength(1);
    expect(await tickRoutines(t + 120_000)).toBe(0); // no transition, no re-fire
  });
});
