import { requireUser } from "@/server/auth";
import { healthReport } from "@/server/system";
import { listBackups } from "@/server/backup";
import { recentAudit } from "@/server/audit";
import { PageHeader, Pill } from "@/components/ui";
import { BackupButton } from "@/components/backup-button";

export const dynamic = "force-dynamic";

function Meter({ label, value, max, unit, warn = 0.75, bad = 0.9 }: { label: string; value: number | null; max: number; unit: string; warn?: number; bad?: number }) {
  const r = value == null ? 0 : value / max;
  return (
    <div className="card rise p-5">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 tnum text-[28px] font-semibold tracking-tight">{value == null ? "—" : `${value}${unit}`}</p>
      <div className="mt-3 h-1.5 rounded-full bg-fill"><div className={`h-full rounded-full ${r >= bad ? "bg-bad" : r >= warn ? "bg-warn" : "bg-fg"}`} style={{ width: `${Math.min(100, r * 100)}%` }} /></div>
    </div>
  );
}

const fmt = (ms: number) => new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function System() {
  const user = await requireUser();
  const h = await healthReport();
  const backups = listBackups();
  const log = recentAudit(40);
  return (
    <div className="mx-auto max-w-[1180px] px-5 md:px-10 pt-10 md:pt-14 pb-12">
      <PageHeader title="System" subtitle={`${h.host.hostname} · ${h.host.arch} · up ${h.host.uptimeH}h · Hearth ${h.version}`}>
        {h.services.every((s) => s.ok) ? <Pill tone="ok">All systems normal</Pill> : <Pill tone="warn">{h.services.filter((s) => !s.ok).length} service(s) need attention</Pill>}
      </PageHeader>
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Meter label="Temperature" value={h.temperatureC} max={85} unit="°C" warn={0.8} bad={0.94} />
        <Meter label="CPU" value={h.cpu.percent} max={100} unit="%" />
        <Meter label="Memory" value={Math.round((h.memory.usedMb / h.memory.totalMb) * 100)} max={100} unit="%" />
        <Meter label="Storage" value={h.storage ? Math.round((h.storage.usedGb / h.storage.totalGb) * 100) : null} max={100} unit="%" />
      </div>
      {h.throttled && h.throttled !== "0x0" && <p className="mt-3 text-[13px] text-warn">The Pi reports throttling or under-voltage ({h.throttled}). Use the official 27 W power supply.</p>}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="card rise p-5">
          <h2 className="text-[13px] font-medium text-fg-2">Services</h2>
          <ul className="mt-3 divide-y divide-line">{h.services.map((s) => (
            <li key={s.name} className="flex items-center gap-3 py-2.5 text-[14px]">
              <span className={`size-2 rounded-full ${s.ok ? "bg-ok" : "bg-bad"}`} />{s.name}<span className="ml-auto text-[13px] text-fg-3 truncate max-w-[55%] text-right">{s.message}</span>
            </li>))}</ul>
        </section>
        <section className="card rise p-5">
          <h2 className="text-[13px] font-medium text-fg-2">Network & data</h2>
          <ul className="mt-3 divide-y divide-line text-[14px]">
            {h.network.interfaces.map((n) => <li key={n.name + n.address} className="flex py-2.5">{n.name}<span className="ml-auto tnum text-fg-3">{n.address}</span></li>)}
            <li className="flex py-2.5">Internet<span className="ml-auto text-fg-3">{h.network.internet ? "Reachable" : "Offline — local features keep working"}</span></li>
            <li className="flex py-2.5">Database<span className="ml-auto tnum text-fg-3">{h.database.sizeMb} MB · {h.database.items} records · {h.database.documents} docs</span></li>
            <li className="flex py-2.5">Load<span className="ml-auto tnum text-fg-3">{h.cpu.load.join(" · ")} ({h.cpu.cores} cores)</span></li>
          </ul>
        </section>
        <section className="card rise p-5">
          <div className="flex items-center"><h2 className="text-[13px] font-medium text-fg-2">Backups</h2>{user.role === "admin" && <div className="ml-auto"><BackupButton /></div>}</div>
          <p className="mt-2 text-[13px] text-fg-3">Daily at 3 AM. Encrypted — restoring needs your master key.</p>
          <ul className="mt-3 divide-y divide-line text-[14px]">
            {backups.length === 0 ? <li className="py-2.5 text-fg-3">No backups yet.</li> : backups.slice(0, 6).map((b) => <li key={b.name} className="flex py-2.5">{fmt(b.createdAt)}<span className="ml-auto tnum text-fg-3">{b.sizeMb} MB</span></li>)}
          </ul>
        </section>
        <section className="card rise p-5">
          <h2 className="text-[13px] font-medium text-fg-2">AI models</h2>
          <ul className="mt-3 divide-y divide-line text-[14px]">
            {h.ai.endpoints.map((e) => (
              <li key={e.url} className="py-2.5"><div className="flex">{e.role === "local" ? "This Pi" : "GPU computer"}<span className="ml-auto text-fg-3">{e.ok ? `${e.models.length} models` : e.message}</span></div>
                {e.ok && <div className="mt-1 text-[12px] text-fg-3">{e.models.join(", ") || "No models pulled yet"}</div>}</li>
            ))}
            <li className="flex py-2.5">Active model<span className="ml-auto text-fg-3">{h.ai.activeModel}</span></li>
          </ul>
        </section>
      </div>

      <section className="card rise mt-6 p-5">
        <h2 className="text-[13px] font-medium text-fg-2">Activity & audit log</h2>
        <ul className="mt-3 divide-y divide-line">{log.map((a) => (
          <li key={a.id} className="flex items-center gap-3 py-2 text-[13px]">
            <span className="w-28 shrink-0 tnum text-fg-3">{fmt(a.ts)}</span>
            <span className="w-24 shrink-0 truncate text-fg-2">{a.actor_kind === "assistant" ? `AI for ${a.actor_name ?? "?"}` : a.actor_name ?? "System"}</span>
            <span className="truncate">{a.action}{a.target ? ` — ${a.target}` : ""}</span>
            <span className="ml-auto"><Pill tone={a.outcome === "ok" ? "neutral" : a.outcome === "pending" ? "accent" : "bad"}>{a.outcome}</Pill></span>
          </li>))}</ul>
      </section>

      {h.problems.length > 0 && (
        <section className="card rise mt-6 p-5">
          <h2 className="text-[13px] font-medium text-fg-2">Recent warnings & errors</h2>
          <ul className="mt-3 space-y-1 font-mono text-[12px] text-fg-2">{h.problems.slice(0, 20).map((p, i) => <li key={i}>{fmt(p.ts)} [{p.level}] {p.msg} {p.ctx ? JSON.stringify(p.ctx) : ""}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
