import { beforeEach, describe, expect, it } from "vitest";
import { openDatabase, useDatabaseForTests } from "../db/client";
import { completeItem, createItem, getItem, listItems, parseInput, ValidationError } from "./repo";

let alex: string, sam: string;

beforeEach(() => {
  const d = openDatabase(":memory:");
  useDatabaseForTests(d);
  const ins = d.prepare("INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)");
  ins.run((alex = "u_alex"), "Alex", "alex@home", "x", "admin", 1);
  ins.run((sam = "u_sam"), "Sam", "sam@home", "x", "member", 2);
});

describe("parseInput", () => {
  it("validates required fields and money", () => {
    expect(() => parseInput("repair", { title: "", due_at: "2026-11-01" }, "UTC")).toThrow(ValidationError);
    expect(() => parseInput("repair", { title: "Faucet", due_at: "2026-11-01", amount: "x" }, "UTC")).toThrow(ValidationError);
    const p = parseInput("repair", { title: "Faucet", amount: "$120.50", due_at: "2026-11-01" }, "UTC");
    expect(p.amount_cents).toBe(12050);
    expect(p.due_at).toBe(Date.UTC(2026, 10, 1));
  });

  it("rejects non-http urls (javascript: injection)", () => {
    expect(() => parseInput("appliance", { title: "P", manual_url: "javascript:alert(1)" }, "UTC")).toThrow(/http/);
  });

  it("rejects select values outside the allowed set", () => {
    expect(() => parseInput("grocery", { title: "Milk", aisle: "Garage" }, "UTC")).toThrow(ValidationError);
  });
});

describe("visibility boundaries", () => {
  it("hides another user's private items", () => {
    const priv = createItem(alex, "note", parseInput("note", { title: "Gift ideas" }, "UTC"), { visibility: "private" });
    createItem(alex, "note", parseInput("note", { title: "Wifi password location" }, "UTC"));
    expect(listItems(sam, { kind: "note" }).map((i) => i.title)).toEqual(["Wifi password location"]);
    expect(getItem(sam, priv.id)).toBeNull();
    expect(listItems(alex, { kind: "note" })).toHaveLength(2);
  });
});

describe("completeItem", () => {
  it("rolls recurring chores forward, clamping month ends", () => {
    const chore = createItem(alex, "chore", parseInput("chore", { title: "Deep clean", due_at: "2026-01-31", recurrence: "monthly" }, "UTC"));
    const { item, rolledTo } = completeItem(sam, chore.id);
    expect(rolledTo).toBe(Date.UTC(2026, 1, 28)); // Jan 31 → Feb 28
    expect(item.status).toBe("open");
    expect((item.data.history as { by: string }[])[0].by).toBe(sam);
  });

  it("closes one-off tasks", () => {
    const t = createItem(alex, "task", parseInput("task", { title: "Call plumber" }, "UTC"));
    expect(completeItem(alex, t.id).item.status).toBe("done");
  });
});
