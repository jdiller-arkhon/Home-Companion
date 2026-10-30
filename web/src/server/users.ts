import { hash, verify } from "@node-rs/argon2";
import { db } from "./db/client";
import { newId } from "./ids";

export type User = {
  id: string; name: string; email: string; role: "admin" | "member"; color: string;
  prefs: UserPrefs; created_at: number; has_pin: boolean;
};

export type UserPrefs = {
  theme?: "system" | "light" | "dark";
  reduceMotion?: boolean;
  textScale?: number;
  widgets?: string[];
  notify?: { packages?: boolean; maintenance?: boolean; reminders?: boolean; security?: boolean };
  briefingEvening?: boolean;
  proactive?: boolean;
};

export const DEFAULT_WIDGETS = ["briefing", "weather", "agenda", "upkeep", "home", "packages", "tasks", "activity"];

type Row = Omit<User, "prefs" | "has_pin"> & { prefs: string; password_hash: string; pin_hash: string | null };

const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 }; // OWASP 2024 baseline, Pi-friendly

function toUser(r: Row): User {
  return {
    id: r.id, name: r.name, email: r.email, role: r.role, color: r.color,
    created_at: r.created_at, prefs: JSON.parse(r.prefs), has_pin: !!r.pin_hash,
  };
}

export function userCount(): number {
  return (db().prepare("SELECT COUNT(*) c FROM users").get() as { c: number }).c;
}

export function listUsers(): User[] {
  return (db().prepare("SELECT * FROM users ORDER BY created_at").all() as Row[]).map(toUser);
}

export function getUser(id: string): User | null {
  const r = db().prepare("SELECT * FROM users WHERE id = ?").get(id) as Row | undefined;
  return r ? toUser(r) : null;
}

export async function createUser(input: { name: string; email: string; password: string; role: "admin" | "member"; color?: string; pin?: string }) {
  const id = newId();
  const passwordHash = await hash(input.password, ARGON);
  const pinHash = input.pin ? await hash(input.pin, ARGON) : null;
  db()
    .prepare("INSERT INTO users (id,name,email,password_hash,pin_hash,role,color,prefs,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(id, input.name.trim(), input.email.trim(), passwordHash, pinHash, input.role, input.color ?? "periwinkle",
      JSON.stringify({ widgets: DEFAULT_WIDGETS, notify: { packages: true, maintenance: true, reminders: true, security: true } }),
      Date.now());
  return getUser(id)!;
}

export async function verifyPassword(email: string, password: string): Promise<User | null> {
  const r = db().prepare("SELECT * FROM users WHERE email = ?").get(email.trim()) as Row | undefined;
  if (!r) {
    await hash(password, ARGON); // equalise timing for unknown accounts
    return null;
  }
  return (await verify(r.password_hash, password)) ? toUser(r) : null;
}

export async function verifySecret(userId: string, secret: string): Promise<boolean> {
  const r = db().prepare("SELECT password_hash, pin_hash FROM users WHERE id = ?").get(userId) as
    | { password_hash: string; pin_hash: string | null } | undefined;
  if (!r) return false;
  if (r.pin_hash && /^\d{4,8}$/.test(secret) && (await verify(r.pin_hash, secret))) return true;
  return verify(r.password_hash, secret);
}

export async function setPassword(userId: string, password: string) {
  db().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(await hash(password, ARGON), userId);
}

export async function setPin(userId: string, pin: string | null) {
  db().prepare("UPDATE users SET pin_hash = ? WHERE id = ?").run(pin ? await hash(pin, ARGON) : null, userId);
}

export function updateProfile(userId: string, patch: { name?: string; color?: string; prefs?: Partial<UserPrefs> }) {
  const u = getUser(userId);
  if (!u) throw new Error("No such user");
  const prefs = { ...u.prefs, ...(patch.prefs ?? {}) };
  db().prepare("UPDATE users SET name = ?, color = ?, prefs = ? WHERE id = ?")
    .run(patch.name?.trim() || u.name, patch.color ?? u.color, JSON.stringify(prefs), userId);
}
