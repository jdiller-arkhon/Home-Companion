import { db } from "./db/client";
import { newId } from "./ids";
import { getUser, listUsers } from "./users";
import { sendPush } from "./push";
import { publish } from "./events";

/**
 * Notifications are stored (in-app inbox) and fanned out to Web Push for each
 * recipient who enabled that category. dedupe_key makes reminder sweeps idempotent.
 */
export type Category = "packages" | "maintenance" | "reminders" | "security" | "briefing";
export type Notification = { id: string; user_id: string | null; kind: string; title: string; body: string; href: string | null; read: boolean; created_at: number };

export async function notify(n: { userId: string | null; category: Category; title: string; body?: string; href?: string; dedupeKey?: string }): Promise<boolean> {
  const id = newId();
  const r = db().prepare("INSERT OR IGNORE INTO notifications (id,user_id,kind,title,body,href,dedupe_key,created_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(id, n.userId, n.category, n.title, n.body ?? "", n.href ?? null, n.dedupeKey ?? null, Date.now());
  if (!r.changes) return false;
  const recipients = n.userId ? [getUser(n.userId)].filter(Boolean) : listUsers();
  for (const u of recipients) {
    const enabled = n.category === "briefing" ? true : u!.prefs.notify?.[n.category] ?? true;
    if (enabled) await sendPush(u!.id, { title: n.title, body: n.body ?? "", href: n.href ?? "/", tag: n.dedupeKey ?? id });
    publish(`notifications:${u!.id}`, u!.id);
  }
  return true;
}

export function inbox(userId: string, limit = 50): Notification[] {
  const rows = db().prepare("SELECT * FROM notifications WHERE user_id IS NULL OR user_id = ? ORDER BY created_at DESC LIMIT ?").all(userId, limit) as (Omit<Notification, "read"> & { read_by: string })[];
  return rows.map(({ read_by, ...r }) => ({ ...r, read: (JSON.parse(read_by) as string[]).includes(userId) }));
}

export function unreadCount(userId: string): number {
  return inbox(userId, 100).filter((n) => !n.read).length;
}

export function markAllRead(userId: string) {
  const rows = db().prepare("SELECT id, read_by FROM notifications WHERE (user_id IS NULL OR user_id = ?)").all(userId) as { id: string; read_by: string }[];
  const upd = db().prepare("UPDATE notifications SET read_by = ? WHERE id = ?");
  db().transaction(() => {
    for (const r of rows) {
      const set = new Set(JSON.parse(r.read_by) as string[]);
      if (!set.has(userId)) { set.add(userId); upd.run(JSON.stringify([...set]), r.id); }
    }
  })();
}
