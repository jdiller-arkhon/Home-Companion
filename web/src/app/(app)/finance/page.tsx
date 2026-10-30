import { ModulePage } from "@/components/module-page";
import { requireUser } from "@/server/auth";
import { financeSummary } from "@/server/finance";
import { formatMoney } from "@/lib/time";
import { BankImport } from "@/components/bank-import";
import { listItems } from "@/server/items/repo";

async function Overview() {
  const user = await requireUser();
  const f = financeSummary(user.id);
  const max = Math.max(1, ...f.trend.map((t) => t.cents));
  return (
    <div className="grid gap-4 md:grid-cols-3 rise">
      <section className="card p-5">
        <p className="eyebrow">Spent in {f.monthLabel}</p>
        <p className="mt-2 tnum text-[32px] font-semibold tracking-tight">{formatMoney(f.monthTotal, f.currency)}</p>
        <div className="mt-5 flex h-16 items-end gap-2" role="img" aria-label="Spending over the last six months">
          {f.trend.map((t, i) => (
            <div key={t.key} className="flex flex-1 flex-col items-center gap-1.5">
              <div className={`w-full rounded-[4px] ${i === 5 ? "bg-fg" : "bg-fill"}`} style={{ height: `${Math.max(4, (t.cents / max) * 48)}px`, border: i === 5 ? undefined : "1px solid var(--line)" }} title={formatMoney(t.cents, f.currency)} />
              <span className="text-[10px] text-fg-3">{t.label}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="card p-5">
        <p className="eyebrow">Committed each month</p>
        <p className="mt-2 tnum text-[32px] font-semibold tracking-tight">{formatMoney(f.committedMonthly, f.currency)}</p>
        <p className="mt-2 text-[13px] text-fg-3">Recurring bills plus {f.subscriptionCount} active subscription{f.subscriptionCount === 1 ? "" : "s"}.</p>
      </section>
      <section className="card p-5">
        <p className="eyebrow">Budgets this month</p>
        {f.budgets.length === 0 ? <p className="mt-3 text-[13px] text-fg-3">Add a budget below to track spending by category.</p> : (
          <ul className="mt-3 space-y-3">{f.budgets.map((b) => {
            const pct = b.limit ? Math.min(100, (b.spent / b.limit) * 100) : 0;
            return (
              <li key={b.category}>
                <div className="flex text-[13px]"><span>{b.category}</span><span className="ml-auto tnum text-fg-2">{formatMoney(b.spent, f.currency)} / {formatMoney(b.limit, f.currency)}</span></div>
                <div className="mt-1.5 h-1.5 rounded-full bg-fill"><div className={`h-full rounded-full ${pct >= 100 ? "bg-bad" : pct >= 80 ? "bg-warn" : "bg-fg"}`} style={{ width: `${pct}%` }} /></div>
              </li>);
          })}</ul>
        )}
      </section>
    </div>
  );
}

async function Balances() {
  const user = await requireUser();
  const accts = listItems(user.id, { kind: "account", status: "active" });
  if (!accts.length) return null;
  const total = accts.reduce((a, x) => a + (x.amount_cents ?? 0), 0);
  const oldest = Math.min(...accts.map((a) => a.due_at ?? Date.now()));
  return (
    <section className="card rise p-5">
      <p className="eyebrow">Total across accounts</p>
      <p className="mt-2 tnum text-[32px] font-semibold tracking-tight">{formatMoney(total)}</p>
      <p className="mt-1 text-[13px] text-fg-3">As of {new Date(oldest).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} — from your latest statement imports, not live.</p>
    </section>
  );
}

export default async function Finance({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  return <ModulePage base="/finance" title="Finance" subtitle="Hearth tracks and reminds — it never moves money." tab={(await searchParams).tab}
    actions={<BankImport />} before={(k) => (k === "overview" ? <Overview /> : k === "accounts" ? <Balances /> : null)} tabs={[
      { key: "overview", label: "Bills", kinds: ["bill"] },
      { key: "accounts", label: "Accounts", kinds: ["account"], empty: { account: "Import a statement from Wescom, or add an account to track its balance by hand." } },
      { key: "subscriptions", label: "Subscriptions", kinds: ["subscription"] },
      { key: "spending", label: "Spending", kinds: ["expense"] },
      { key: "budgets", label: "Budgets", kinds: ["budget"] },
      { key: "savings", label: "Savings", kinds: ["savings_goal"] },
    ]} />;
}
