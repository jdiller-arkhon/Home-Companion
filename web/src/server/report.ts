import { listItems, type Item } from "./items/repo";
import { listUsers } from "./users";
import { listDocs } from "./vault";
import { db } from "./db/client";

type H = { at: number; by: string };
const history = (i: Item) => (Array.isArray(i.data.history) ? (i.data.history as H[]) : []);

/** A year in the life of the house: who did what, what was fixed, what's coming up next year. */
export function yearReport(viewerId: string, year: number) {
  const from = Date.UTC(year, 0, 1), to = Date.UTC(year + 1, 0, 1), nextTo = Date.UTC(year + 2, 0, 1);
  const inYear = (t: number) => t >= from && t < to;
  const users = listUsers();
  const all = listItems(viewerId, { limit: 100_000 });
  const by = (k: string[]) => all.filter((i) => k.includes(i.kind));

  const completions = by(["task", "chore", "errand", "maintenance"]).flatMap((i) => history(i).filter((h) => inYear(h.at)).map((h) => ({ ...h, kind: i.kind, title: i.title })));
  const perPerson = users.map((u) => ({ name: u.name, count: completions.filter((c) => c.by === u.id).length }));
  const topChores = Object.entries(completions.filter((c) => c.kind === "chore").reduce<Record<string, number>>((a, c) => ({ ...a, [c.title]: (a[c.title] ?? 0) + 1 }), {}))
    .sort((a, b) => b[1] - a[1]).slice(0, 5);
  const repairs = by(["repair"]).filter((r) => r.due_at && inYear(r.due_at)).sort((a, b) => a.due_at! - b.due_at!);
  const repairCost = repairs.reduce((a, r) => a + (r.amount_cents ?? 0), 0);
  const maintenanceDone = completions.filter((c) => c.kind === "maintenance");
  const appliancesAdded = by(["appliance"]).filter((a) => inYear(a.created_at));
  const warrantiesNext = by(["appliance"]).filter((a) => a.status === "in_service" && a.due_at && a.due_at >= to && a.due_at < nextTo).sort((a, b) => a.due_at! - b.due_at!);
  const vehicles = by(["vehicle"]).filter((v) => v.status === "active");
  const delivered = by(["package"]).filter((p) => p.status === "delivered" && inYear(p.updated_at)).length;
  const events = by(["event"]).filter((e) => e.due_at && inYear(e.due_at)).length;
  const groceryTrips = new Set(by(["grocery"]).filter((g) => g.status === "done" && inYear(Number(g.data.last_done ?? g.updated_at))).map((g) => new Date(Number(g.data.last_done ?? g.updated_at)).toISOString().slice(0, 10))).size;
  const docsExpiring = listDocs(viewerId).filter((d) => d.expires_at && d.expires_at >= to && d.expires_at < nextTo);
  const routineRuns = (db().prepare("SELECT COUNT(*) c FROM audit_log WHERE action LIKE 'routine:%' AND outcome='ok' AND ts >= ? AND ts < ?").get(from, to) as { c: number }).c;
  return { year, completions: completions.length, perPerson, topChores, repairs, repairCost, maintenanceDone: maintenanceDone.length, appliancesAdded, warrantiesNext, vehicles, delivered, events, groceryTrips, docsExpiring, routineRuns };
}
