import webpush from "web-push";
import { db } from "./db/client";
import { getSecret, setSecret } from "./settings";
import { log } from "./log";

/** Web Push (VAPID). Keys are generated on first use and stored encrypted. Works on iOS 16.4+ for Home Screen apps. */
function vapid(): { publicKey: string; privateKey: string } {
  const existing = getSecret("vapid");
  if (existing) return JSON.parse(existing);
  const keys = webpush.generateVAPIDKeys();
  setSecret("vapid", JSON.stringify(keys));
  return keys;
}

export function vapidPublicKey(): string {
  return vapid().publicKey;
}

export function saveSubscription(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, ua: string | null) {
  const u = new URL(sub.endpoint);
  if (u.protocol !== "https:") throw new Error("Invalid push endpoint");
  db().prepare("INSERT INTO push_subscriptions (endpoint,user_id,keys,user_agent,created_at) VALUES (?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, keys=excluded.keys")
    .run(sub.endpoint, userId, JSON.stringify(sub.keys), ua?.slice(0, 200) ?? null, Date.now());
}

export function removeSubscription(endpoint: string) {
  db().prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
}

export function subscriptionCount(userId: string): number {
  return (db().prepare("SELECT COUNT(*) c FROM push_subscriptions WHERE user_id = ?").get(userId) as { c: number }).c;
}

export async function sendPush(userId: string, payload: { title: string; body: string; href: string; tag: string }) {
  const subs = db().prepare("SELECT endpoint, keys FROM push_subscriptions WHERE user_id = ?").all(userId) as { endpoint: string; keys: string }[];
  if (!subs.length) return;
  const { publicKey, privateKey } = vapid();
  webpush.setVapidDetails("mailto:hearth@localhost", publicKey, privateKey);
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: JSON.parse(s.keys) }, JSON.stringify(payload), { TTL: 6 * 3600 });
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) removeSubscription(s.endpoint);
      else log.warn("push.failed", { code, error: String(e).slice(0, 200) });
    }
  }));
}
