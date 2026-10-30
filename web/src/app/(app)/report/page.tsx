import Link from "next/link";
import { requireUser } from "@/server/auth";
import { yearReport } from "@/server/report";
import { getSettings } from "@/server/settings";
import { formatMoney } from "@/lib/time";
import { PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

const d = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="card p-5"><p className="eyebrow">{label}</p><p className="mt-2 tnum text-[30px] font-semibold tracking-tight">{value}</p></div>;
}

export default async function Report({ searchParams }: { searchParams: Promise<{ y?: string }> }) {
  const user = await requireUser();
  const now = new Date().getUTCFullYear();
  const year = Math.min(now, Math.max(2020, +((await searchParams).y ?? now)));
  const r = yearReport(user.id, year);
  return (
    <div className="mx-auto max-w-[980px] px-5 md:px-10 pt-10 md:pt-14 pb-12 print:pt-0">
      <PageHeader title={`${getSettings().household_name} in ${year}`} subtitle="A year of keeping house, together.">
        <div className="flex gap-2 print:hidden">
          <Link href={`/report?y=${year - 1}`} className="press rounded-[10px] border border-line px-3 py-2 text-[13px] hover:bg-fill">{year - 1}</Link>
          {year < now && <Link href={`/report?y=${year + 1}`} className="press rounded-[10px] border border-line px-3 py-2 text-[13px] hover:bg-fill">{year + 1}</Link>}
          <PrintButton />
        </div>
      </PageHeader>
      <div className="rise mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Things done" value={r.completions} />
        <Stat label="Upkeep tasks" value={r.maintenanceDone} />
        <Stat label="Events" value={r.events} />
        <Stat label="Deliveries" value={r.delivered} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="card rise p-5">
          <h2 className="text-[13px] font-medium text-fg-2">Who did what</h2>
          <ul className="mt-3 space-y-3">{r.perPerson.map((p) => {
            const pct = r.completions ? (p.count / r.completions) * 100 : 0;
            return <li key={p.name}><div className="flex text-[14px]"><span>{p.name}</span><span className="ml-auto tnum text-fg-2">{p.count}</span></div>
              <div className="mt-1.5 h-1.5 rounded-full bg-fill"><div className="h-full rounded-full bg-fg" style={{ width: `${pct}%` }} /></div></li>;
          })}</ul>
          {r.topChores.length > 0 && <p className="mt-4 text-[13px] text-fg-3">Most frequent: {r.topChores.map(([t, n]) => `${t} (${n}×)`).join(", ")}</p>}
          <p className="mt-2 text-[13px] text-fg-3">{r.groceryTrips} grocery runs · {r.routineRuns} routines ran on their own</p>
        </section>
        <section className="card rise p-5">
          <h2 className="text-[13px] font-medium text-fg-2">Repairs {r.repairCost ? `· ${formatMoney(r.repairCost)}` : ""}</h2>
          <ul className="mt-3 divide-y divide-line text-[14px]">
            {r.repairs.length ? r.repairs.map((x) => <li key={x.id} className="flex py-2"><span className="w-16 text-fg-3">{d(x.due_at!)}</span><span className="flex-1 truncate">{x.title}</span>{x.amount_cents != null && <span className="tnum">{formatMoney(x.amount_cents)}</span>}</li>)
              : <li className="py-2 text-fg-3">Nothing broke. Nice.</li>}
          </ul>
        </section>
        <section className="card rise p-5">
          <h2 className="text-[13px] font-medium text-fg-2">Coming up in {year + 1}</h2>
          <ul className="mt-3 divide-y divide-line text-[14px]">
            {r.warrantiesNext.map((a) => <li key={a.id} className="flex py-2"><span className="flex-1 truncate">{a.title} warranty ends</span><span className="text-fg-3">{d(a.due_at!)}</span></li>)}
            {r.docsExpiring.map((x) => <li key={x.id} className="flex py-2"><span className="flex-1 truncate">{x.name} expires</span><span className="text-fg-3">{d(x.expires_at!)}</span></li>)}
            {r.vehicles.filter((v) => v.due_at).map((v) => <li key={v.id} className="flex py-2"><span className="flex-1 truncate">{v.title} registration</span><span className="text-fg-3">{d(v.due_at!)}</span></li>)}
            {!r.warrantiesNext.length && !r.docsExpiring.length && !r.vehicles.some((v) => v.due_at) && <li className="py-2 text-fg-3">Nothing scheduled to expire.</li>}
          </ul>
        </section>
        <section className="card rise p-5">
          <h2 className="text-[13px] font-medium text-fg-2">The house</h2>
          <ul className="mt-3 divide-y divide-line text-[14px]">
            <li className="flex py-2">New appliances<span className="ml-auto text-fg-3">{r.appliancesAdded.map((a) => a.title).join(", ") || "—"}</span></li>
            {r.vehicles.map((v) => <li key={v.id} className="flex py-2">{v.title}<span className="ml-auto tnum text-fg-3">{v.data.mileage ? `${Number(v.data.mileage).toLocaleString()} mi` : "—"}</span></li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}
