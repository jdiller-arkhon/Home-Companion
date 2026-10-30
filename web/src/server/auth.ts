import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db/client";
import { env } from "./env";
import { randomToken, sha256 } from "./crypto";
import { getUser, type User } from "./users";

export const SESSION_COOKIE = "hearth_session";
const SESSION_DAYS = 30;
const ELEVATION_MS = 5 * 60_000;

type SessionRow = { id_hash: string; user_id: string; expires_at: number; elevated_until: number };

export async function createSession(userId: string) {
  const token = randomToken();
  const now = Date.now();
  const ua = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  db().prepare("INSERT INTO sessions (id_hash,user_id,created_at,expires_at,user_agent) VALUES (?,?,?,?,?)")
    .run(sha256(token), userId, now, now + SESSION_DAYS * 86_400_000, ua);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: env().secureCookies, path: "/", maxAge: SESSION_DAYS * 86_400,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) db().prepare("DELETE FROM sessions WHERE id_hash = ?").run(sha256(token));
  jar.delete(SESSION_COOKIE);
}

async function currentSession(): Promise<SessionRow | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = db().prepare("SELECT * FROM sessions WHERE id_hash = ?").get(sha256(token)) as SessionRow | undefined;
  if (!row || row.expires_at < Date.now()) return null;
  return row;
}

export async function getCurrentUser(): Promise<User | null> {
  const s = await currentSession();
  return s ? getUser(s.user_id) : null;
}

/** For pages and server actions. Redirects to /login when signed out. */
export async function requireUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (u.role !== "admin") throw new Error("Administrator access required");
  return u;
}

/** Sensitive actions require a recent re-authentication (password or PIN). */
export async function isElevated(): Promise<boolean> {
  const s = await currentSession();
  return !!s && s.elevated_until > Date.now();
}

export async function markElevated() {
  const s = await currentSession();
  if (s) db().prepare("UPDATE sessions SET elevated_until = ? WHERE id_hash = ?").run(Date.now() + ELEVATION_MS, s.id_hash);
}

/** Reject cross-origin state-changing requests to route handlers. */
export async function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return; // same-origin fetches from older Safari may omit it; SameSite=Lax still applies
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (new URL(origin).host !== host) throw new Response("Cross-origin request rejected", { status: 403 });
}

// Simple fixed-window limiter for login/PIN attempts (per key, in memory).
const attempts = new Map<string, { count: number; resetAt: number }>();
export function rateLimit(key: string, max = 8, windowMs = 15 * 60_000): boolean {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  a.count++;
  return a.count <= max;
}
