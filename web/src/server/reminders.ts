import { listUsers } from "./users";
import { listItems } from "./items/repo";
import { getSettings } from "./settings";
import { notify } from "./notifications";
import { snapshot, briefingLines } from "./briefing";
import { db } from "./db/client";
import { DAY, formatMoney, todayIn, tzOffset } from "@/lib/time";

const when = (d: number) => (d < 0 ? `${-d} day${d === -1 ? "" : "s"} overdue` : d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`);

/**
 * Idempotent reminder sweep — safe to run every few minutes. Each reminder has
 * a dedupe key tied to the item and its due date, so it fires once per cycle.
 * Runs per user so private items only notify their owner.
 */
export async function sweepReminders(now = Date.now()) {
  const s = getSettings();
  const today = todayIn(s.timezone, now);
  const hour = new Date(now + tzOffset(now, s.timezone)).getUTCHours();
  const dateKey = new Date(today).toISOString().slice(0, 10);
  let sent = 0;
  const send = async (...a: Parameters<typeof notify>) => { if (await notify(...a)) sent++; };

  for (const u of listUsers()) {
    const days = (ms: number) => Math.round((ms - today) / DAY);

    for (const b of listItems(u.id, { kind: "bill", status: "open", dueBefore: today + 4 * DAY })) {
      if (b.data.autopay) continue;
      await send({ userId: u.id, category: "bills", title: `${b.title} is due ${when(days(b.due_at!))}`, body: formatMoney(b.amount_cents, s.currency), href: "/finance", dedupeKey: `bill:${b.id}:${b.due_at}:${u.id}` });
    }
    for (const sub of listItems(u.id, { kind: "subscription", status: "active", dueAfter: today, dueBefore: today + 3 * DAY })) {
      await send({ userId: u.id, category: "bills", title: `${sub.title} renews ${when(days(sub.due_at!))}`, body: formatMoney(sub.amount_cents, s.currency), href: "/finance?tab=subscriptions", dedupeKey: `sub:${sub.id}:${sub.due_at}:${u.id}` });
    }
    for (const t of listItems(u.id, { kind: ["task", "chore", "errand"], status: "open", dueBefore: today + DAY })) {
      if (t.data.assignee && t.data.assignee !== u.name) continue;
      await send({ userId: u.id, category: "reminders", title: `${t.title} — ${when(days(t.due_at!))}`, href: "/planner?tab=tasks", dedupeKey: `task:${t.id}:${t.due_at}:${u.id}` });
    }
    for (const p of listItems(u.id, { kind: "package", status: ["ordered", "in_transit", "out_for_delivery"], dueBefore: today + DAY })) {
      await send({ userId: u.id, category: "packages", title: `${p.title} arrives ${when(Math.max(0, days(p.due_at!)))}`, body: [p.data.carrier, p.data.tracking].filter(Boolean).join(" · "), href: "/packages", dedupeKey: `pkg:${p.id}:${p.due_at}:${u.id}` });
    }
    for (const m of listItems(u.id, { kind: ["maintenance", "vehicle"], status: ["open", "active"], dueBefore: today + 3 * DAY })) {
      await send({ userId: u.id, category: "maintenance", title: `${m.title} ${m.kind === "vehicle" ? "registration is due" : "is due"} ${when(days(m.due_at!))}`, href: "/maintenance", dedupeKey: `mnt:${m.id}:${m.due_at}:${u.id}` });
    }
    for (const a of listItems(u.id, { kind: "appliance", status: "in_service", dueAfter: today, dueBefore: today + 30 * DAY })) {
      await send({ userId: u.id, category: "maintenance", title: `${a.title} warranty ends ${when(days(a.due_at!))}`, href: "/maintenance?tab=appliances", dedupeKey: `war:${a.id}:${a.due_at}:${u.id}` });
    }
    for (const c of listItems(u.id, { kind: "consumable" })) {
      if (c.data.reorder_at == null || Number(c.data.stock) > Number(c.data.reorder_at)) continue;
      await send({ userId: u.id, category: "reminders", title: `Running low on ${c.title}`, body: `${c.data.stock} left`, href: "/maintenance?tab=supplies", dedupeKey: `low:${c.id}:${c.data.stock}:${u.id}` });
    }
    for (const o of listItems(u.id, { kind: "occasion" })) {
      const d = new Date(o.due_at!);
      let next = Date.UTC(new Date(today).getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      if (next < today) next = Date.UTC(new Date(today).getUTCFullYear() + 1, d.getUTCMonth(), d.getUTCDate());
      const lead = Number(o.data.remind_days ?? 3);
      const dd = days(next);
      if (dd === lead || dd === 0) await send({ userId: u.id, category: "reminders", title: `${o.title} ${String(o.data.type ?? "").toLowerCase() || "occasion"} ${when(dd)}`, href: "/planner?tab=occasions", dedupeKey: `occ:${o.id}:${next}:${dd}:${u.id}` });
    }
    const docs = db().prepare("SELECT id, name, expires_at FROM documents WHERE expires_at IS NOT NULL AND expires_at BETWEEN ? AND ? AND (visibility='shared' OR owner_id=?)")
      .all(today, today + 30 * DAY, u.id) as { id: string; name: string; expires_at: number }[];
    for (const d of docs) {
      const dd = days(d.expires_at);
      if ([30, 7, 1, 0].includes(dd)) await send({ userId: u.id, category: "reminders", title: `${d.name} expires ${when(dd)}`, href: "/vault", dedupeKey: `doc:${d.id}:${dd}:${u.id}` });
    }

    // Briefings: morning at the configured hour, optional evening recap at 8 PM.
    if (hour === s.morning_briefing_hour || (s.evening_recap && hour === 20)) {
      const mode = hour === 20 ? "evening" : "morning";
      const snap = await snapshot(u.id);
      const lines = briefingLines(snap, mode);
      await send({ userId: u.id, category: "briefing", title: mode === "morning" ? `Good morning, ${u.name}` : `Evening recap`, body: lines.slice(0, 4).join(" "), href: "/", dedupeKey: `brief:${mode}:${dateKey}:${u.id}` });

      // Security check-in at night: unlocked doors or open garage.
      if (mode === "evening" && snap.home && (snap.home.unlocked.length || snap.home.open.length)) {
        await send({ userId: u.id, category: "security", title: "Home isn't secured for the night", body: [...snap.home.unlocked, ...snap.home.open].map((d) => d.name).join(", "), href: "/devices", dedupeKey: `sec:${dateKey}:${u.id}` });
      }
    }
  }
  return sent;
}
