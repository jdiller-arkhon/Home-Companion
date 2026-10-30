"use server";
import { requireUser } from "./auth";
import { getItem } from "./items/repo";
import { listUsers } from "./users";
import { notify } from "./notifications";
import { audit } from "./audit";

/** "Did anyone take the trash out?" — pings everyone else in the household about an open item. */
export async function nudge(itemId: string): Promise<string> {
  const u = await requireUser();
  const it = getItem(u.id, itemId);
  if (!it) return "Not found.";
  if (it.visibility === "private") return "That item is private, so there's nobody else to ask.";
  const others = listUsers().filter((x) => x.id !== u.id);
  if (!others.length) return "There's nobody else in the household yet.";
  const hour = Math.floor(Date.now() / 3_600_000);
  for (const o of others) {
    await notify({ userId: o.id, category: "reminders", title: `${u.name} asks: is “${it.title}” done?`, body: "Tap to check it off if it is.",
      href: `/planner?tab=${it.kind === "chore" ? "chores" : "tasks"}`, dedupeKey: `nudge:${it.id}:${o.id}:${hour}` });
  }
  audit({ actorId: u.id, actorKind: "user", action: "item:nudge", target: it.title, outcome: "ok" });
  return `Asked ${others.map((o) => o.name).join(" and ")}.`;
}
