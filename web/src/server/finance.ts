import { listItems } from "./items/repo";
import { getSettings } from "./settings";
import { todayIn } from "@/lib/time";

/** Month-to-date spending vs budgets, monthly committed costs and a 6-month trend. */
export function financeSummary(viewerId: string) {
  const s = getSettings();
  const today = new Date(todayIn(s.timezone));
  const monthStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1);
  const nextMonth = Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1);
  const sixAgo = Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1);
  const expenses = listItems(viewerId, { kind: "expense", dueAfter: sixAgo, limit: 5000 });

  const byCategory = new Map<string, number>();
  const trend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5 + i, 1));
    return { key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`, label: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }), cents: 0 };
  });
  let monthTotal = 0;
  for (const e of expenses) {
    const d = new Date(e.due_at!);
    const t = trend.find((x) => x.key === `${d.getUTCFullYear()}-${d.getUTCMonth()}`);
    if (t) t.cents += e.amount_cents ?? 0;
    if (e.due_at! >= monthStart && e.due_at! < nextMonth) {
      monthTotal += e.amount_cents ?? 0;
      const c = String(e.data.category ?? "Other");
      byCategory.set(c, (byCategory.get(c) ?? 0) + (e.amount_cents ?? 0));
    }
  }
  const budgets = listItems(viewerId, { kind: "budget" }).map((b) => ({ category: b.title, limit: b.amount_cents ?? 0, spent: byCategory.get(b.title) ?? 0 }));
  const perMonth: Record<string, number> = { weekly: 52 / 12, biweekly: 26 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };
  const subs = listItems(viewerId, { kind: "subscription", status: "active" });
  const subsMonthly = subs.reduce((a, x) => a + (x.amount_cents ?? 0) * (perMonth[String(x.data.recurrence ?? "monthly")] ?? 1), 0);
  const bills = listItems(viewerId, { kind: "bill", status: "open" });
  const billsMonthly = bills.reduce((a, x) => a + (x.amount_cents ?? 0) * (perMonth[String(x.data.recurrence ?? "none")] ?? 0), 0);
  return {
    currency: s.currency, monthLabel: today.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }), monthTotal,
    categories: [...byCategory.entries()].sort((a, b) => b[1] - a[1]), budgets, trend,
    committedMonthly: Math.round(subsMonthly + billsMonthly), subscriptionCount: subs.length,
  };
}
