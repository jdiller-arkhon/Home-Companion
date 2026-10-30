import Link from "next/link";
import { ArrowUpRight, Sparkles, CloudSun, Package, Receipt, ShieldCheck, CalendarDays, CheckCircle2 } from "lucide-react";
import { requireUser } from "@/server/auth";
import { snapshot, briefingLines } from "@/server/briefing";
import { describeWeather } from "@/server/integrations/weather";
import { formatMoney, relativeDay, tzOffset } from "@/lib/time";

function greeting(tz: string) {
  const h = new Date(Date.now() + tzOffset(Date.now(), tz)).getUTCHours();
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Panel({ title, icon: Icon, href, children, className = "" }: { title: string; icon: React.ElementType; href?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card rise p-5 ${className}`}>
      <header className="flex items-center gap-2 mb-4">
        <Icon size={15} strokeWidth={1.75} className="text-fg-3" />
        <h2 className="text-[13px] font-medium text-fg-2">{title}</h2>
        {href && <Link href={href} className="ml-auto text-fg-3 hover:text-fg" aria-label={`Open ${title}`}><ArrowUpRight size={15} /></Link>}
      </header>
      {children}
    </section>
  );
}

function Empty({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="text-[13px] text-fg-3">
      {text} <Link href={href} className="text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">{cta}</Link>
    </div>
  );
}

export default async function Today() {
  const user = await requireUser();
  const s = await snapshot(user.id);
  const lines = briefingLines(s);
  const date = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: s.tz });

  return (
    <div className="mx-auto max-w-[1180px] px-5 md:px-10 pt-10 md:pt-14 pb-10">
      <p className="eyebrow rise">{date}</p>
      <h1 className="rise mt-2 text-[34px] md:text-[44px] font-semibold tracking-[-0.035em] leading-[1.05]">
        {greeting(s.tz)}, {user.name}.
      </h1>

      <section className="rise mt-8 rounded-[18px] border border-line bg-gradient-to-b from-accent-soft to-transparent p-6">
        <div className="flex items-center gap-2 text-accent"><Sparkles size={14} strokeWidth={2} /><span className="text-[12px] font-medium">Briefing</span></div>
        <ul className="mt-3 space-y-1.5 text-[15px] leading-relaxed text-fg">
          {lines.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-6">
        <Panel title="Weather" icon={CloudSun} className="md:col-span-2">
          {"unavailable" in s.weather ? <Empty text={s.weather.unavailable} href="/settings" cta="Settings" /> : (
            <div>
              <div className="flex items-baseline gap-2"><span className="tnum text-[44px] font-semibold tracking-tight">{Math.round(s.weather.current.temp)}°</span><span className="text-fg-2 text-[14px]">{describeWeather(s.weather.current.code)}</span></div>
              <div className="mt-4 grid grid-cols-5 gap-1 text-center text-[12px]">
                {s.weather.daily.slice(0, 5).map((d) => (
                  <div key={d.date}><div className="text-fg-3">{new Date(d.date + "T12:00").toLocaleDateString("en-US", { weekday: "short" })}</div><div className="tnum mt-1">{Math.round(d.max)}°</div></div>
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Up next" icon={CalendarDays} href="/planner" className="md:col-span-4">
          {s.events.length + s.tasks.length === 0 ? <Empty text="Nothing scheduled this week." href="/planner" cta="Add an event" /> : (
            <ul className="divide-y divide-line">
              {[...s.events, ...s.tasks].sort((a, b) => a.due_at! - b.due_at!).slice(0, 5).map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-2.5 text-[14px]">
                  <span className="size-1.5 rounded-full bg-fg-3" />{i.title}
                  <span className="ml-auto text-fg-3 text-[13px] tnum">{relativeDay(i.due_at!, s.today)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Bills" icon={Receipt} href="/finance" className="md:col-span-2">
          {s.bills.length === 0 ? <Empty text="No bills due soon." href="/finance" cta="Track a bill" /> : (
            <ul className="space-y-3">
              {s.bills.slice(0, 4).map((b) => (
                <li key={b.id} className="flex items-baseline text-[14px]"><span className="truncate">{b.title}</span>
                  <span className="ml-auto pl-3 tnum">{formatMoney(b.amount_cents, s.currency)}</span></li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Home" icon={ShieldCheck} href="/devices" className="md:col-span-2">
          {s.home ? (
            <div className="text-[14px] space-y-2">
              <div className="flex"><span className="text-fg-2">Lights on</span><span className="ml-auto tnum">{s.home.lightsOn.length}</span></div>
              <div className="flex"><span className="text-fg-2">Unlocked</span><span className={`ml-auto tnum ${s.home.unlocked.length ? "text-warn" : ""}`}>{s.home.unlocked.length}</span></div>
              <div className="flex"><span className="text-fg-2">Offline</span><span className="ml-auto tnum">{s.home.offline.length}</span></div>
            </div>
          ) : <Empty text={s.homeError ?? "Home Assistant isn't connected yet."} href="/settings" cta="Connect" />}
        </Panel>

        <Panel title="Packages" icon={Package} href="/packages" className="md:col-span-2">
          {s.packages.length === 0 ? <Empty text="Nothing on the way." href="/packages" cta="Track a package" /> : (
            <ul className="space-y-3 text-[14px]">{s.packages.slice(0, 4).map((p) => (
              <li key={p.id} className="flex"><span className="truncate">{p.title}</span><span className="ml-auto pl-3 text-fg-3 capitalize">{p.status.replace(/_/g, " ")}</span></li>
            ))}</ul>
          )}
        </Panel>
      </div>

      {s.overdue.length === 0 && (
        <p className="rise mt-8 flex items-center gap-2 text-[13px] text-fg-3"><CheckCircle2 size={14} className="text-ok" /> Nothing overdue. Nicely done.</p>
      )}
    </div>
  );
}
