import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { requireUser } from "@/server/auth";
import { listItems } from "@/server/items/repo";
import { externalOccurrences } from "@/server/calendar";
import { getSettings } from "@/server/settings";
import { DAY, todayIn, tzOffset } from "@/lib/time";

const DOT: Record<string, string> = { external: "bg-accent/50", external_allday: "bg-accent/50", event: "bg-accent", task: "bg-fg", chore: "bg-fg-2", occasion: "bg-ok", maintenance: "bg-fg-3", errand: "bg-fg-2", meal: "bg-fg-3" };

/** Month grid of everything dated: events, tasks, chores, occasions (yearly), upkeep. */
export async function MonthView({ month }: { month?: string }) {
  const user = await requireUser();
  const s = getSettings();
  const today = todayIn(s.timezone);
  const m = /^\d{4}-\d{2}$/.test(month ?? "") ? month! : new Date(today).toISOString().slice(0, 7);
  const [y, mo] = m.split("-").map(Number);
  const first = Date.UTC(y, mo - 1, 1);
  const gridStart = first - new Date(first).getUTCDay() * DAY;
  const next = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7);
  const prev = new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7);

  // datetime items need shifting into household-local calendar days.
  const localDay = (ms: number, isDatetime: boolean) => {
    if (!isDatetime) return ms;
    const l = ms + tzOffset(ms, s.timezone);
    return l - (((l % DAY) + DAY) % DAY);
  };
  const items = listItems(user.id, { kind: ["event", "task", "chore", "maintenance", "errand", "meal"], dueAfter: gridStart - DAY, dueBefore: gridStart + 43 * DAY, limit: 2000 })
    .filter((i) => !["done", "cancelled"].includes(i.status));
  const byDay = new Map<number, { title: string; kind: string; href: string }[]>();
  const add = (day: number, e: { title: string; kind: string; href: string }) => byDay.set(day, [...(byDay.get(day) ?? []), e]);
  for (const i of items) add(localDay(i.due_at!, i.kind === "event"), { title: i.title, kind: i.kind, href: i.kind === "maintenance" ? "/maintenance" : `/planner?tab=${i.kind === "event" ? "agenda" : i.kind === "meal" ? "meals" : i.kind === "chore" ? "chores" : "tasks"}` });
  for (const x of externalOccurrences(user.id, gridStart, gridStart + 42 * DAY)) add(localDay(x.due_at!, x.kind === "external"), { title: x.title, kind: x.kind, href: "/settings#calendars" });
  for (const o of listItems(user.id, { kind: "occasion" })) {
    const d = new Date(o.due_at!);
    for (const yr of [y - 1, y, y + 1]) add(Date.UTC(yr, d.getUTCMonth(), d.getUTCDate()), { title: o.title, kind: "occasion", href: "/planner?tab=occasions" });
  }

  return (
    <section className="card rise overflow-hidden">
      <header className="flex items-center gap-2 px-4 py-3">
        <h2 className="text-[15px] font-semibold tracking-tight">{new Date(first).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</h2>
        <div className="ml-auto flex items-center gap-1">
          <Link scroll={false} href={`/planner?tab=agenda&m=${prev}`} aria-label="Previous month" className="press rounded-md p-1.5 text-fg-2 hover:bg-fill"><ChevronLeft size={16} /></Link>
          <Link scroll={false} href="/planner?tab=agenda" className="press rounded-md px-2 py-1 text-[12px] text-fg-2 hover:bg-fill">Today</Link>
          <Link scroll={false} href={`/planner?tab=agenda&m=${next}`} aria-label="Next month" className="press rounded-md p-1.5 text-fg-2 hover:bg-fill"><ChevronRight size={16} /></Link>
        </div>
      </header>
      <div className="grid grid-cols-7 border-t border-line text-center text-[11px] text-fg-3">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-1.5">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: 42 }, (_, i) => {
          const day = gridStart + i * DAY;
          const inMonth = new Date(day).getUTCMonth() === mo - 1;
          const evs = byDay.get(day) ?? [];
          return (
            <div key={i} className={clsx("min-h-[76px] border-t border-line p-1.5 md:min-h-[96px]", i % 7 && "border-l", !inMonth && "bg-fill/50")}>
              <div className={clsx("mb-1 grid size-6 place-items-center rounded-full text-[12px] tnum", day === today ? "bg-fg font-semibold text-bg" : inMonth ? "text-fg-2" : "text-fg-3/60")}>{new Date(day).getUTCDate()}</div>
              <ul className="space-y-0.5">
                {evs.slice(0, 3).map((e, j) => (
                  <li key={j}><Link href={e.href} className="flex items-center gap-1 truncate rounded px-0.5 text-[11px] leading-4 hover:bg-fill">
                    <span className={clsx("size-1.5 shrink-0 rounded-full", DOT[e.kind])} /><span className="truncate">{e.title}</span></Link></li>
                ))}
                {evs.length > 3 && <li className="px-0.5 text-[10px] text-fg-3">+{evs.length - 3} more</li>}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
