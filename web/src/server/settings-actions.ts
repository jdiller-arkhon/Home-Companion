"use server";
import { revalidatePath } from "next/cache";
import { requireUser, requireAdmin, isElevated } from "./auth";
import { audit } from "./audit";
import { getSettings, updateSettings, setSecret } from "./settings";
import { createUser, setPassword, setPin, updateProfile, verifySecret } from "./users";
import { ping } from "./integrations/homeassistant";
import { runBackup } from "./backup";

export type Result = { ok?: boolean; error?: string; message?: string };

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function safeUrl(u: string): string {
  if (!u) return "";
  const p = new URL(u);
  if (!["http:", "https:"].includes(p.protocol)) throw new Error("Use an http(s) address");
  return p.toString().replace(/\/$/, "");
}

export async function saveHousehold(_: Result, f: FormData): Promise<Result> {
  const u = await requireAdmin();
  const lat = str(f, "latitude"), lon = str(f, "longitude");
  if ((lat && (isNaN(+lat) || Math.abs(+lat) > 90)) || (lon && (isNaN(+lon) || Math.abs(+lon) > 180))) return { error: "Latitude/longitude look invalid." };
  const tz = str(f, "timezone");
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); } catch { return { error: "Unknown time zone." }; }
  updateSettings({
    household_name: str(f, "household_name") || "Our Home", timezone: tz, location_label: str(f, "location_label"),
    latitude: lat ? +lat : null, longitude: lon ? +lon : null,
    temperature_unit: str(f, "temperature_unit") === "celsius" ? "celsius" : "fahrenheit",
    currency: /^[A-Z]{3}$/.test(str(f, "currency")) ? str(f, "currency") : "USD",
  });
  audit({ actorId: u.id, actorKind: "user", action: "settings:household", outcome: "ok" });
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

export async function saveHomeAssistant(_: Result, f: FormData): Promise<Result> {
  const u = await requireAdmin();
  try {
    updateSettings({ ha_url: safeUrl(str(f, "ha_url")) });
    const token = str(f, "ha_token");
    if (token) setSecret("ha_token", token);
    if (f.get("disconnect") === "1") { setSecret("ha_token", null); updateSettings({ ha_url: "" }); }
  } catch (e) { return { error: (e as Error).message }; }
  audit({ actorId: u.id, actorKind: "user", action: "settings:home_assistant", outcome: "ok" });
  revalidatePath("/", "layout");
  if (!getSettings().ha_url) return { ok: true, message: "Disconnected." };
  const p = await ping();
  return p.ok ? { ok: true, message: `Connected — ${p.message}` } : { error: p.message };
}

export async function saveAI(_: Result, f: FormData): Promise<Result> {
  const u = await requireAdmin();
  try {
    updateSettings({ ai_endpoint: safeUrl(str(f, "ai_endpoint")) || "http://127.0.0.1:11434", ai_remote_endpoint: safeUrl(str(f, "ai_remote_endpoint")),
      ai_model: str(f, "ai_model") || "qwen2.5:3b", ai_prefer_remote: f.get("ai_prefer_remote") === "on",
      morning_briefing_hour: Math.min(11, Math.max(4, +str(f, "morning_briefing_hour") || 7)), evening_recap: f.get("evening_recap") === "on",
      assistant_name: str(f, "assistant_name").slice(0, 30) || "Hearth", assistant_voice: /^[a-zA-Z0-9_-]+$/.test(str(f, "assistant_voice")) ? str(f, "assistant_voice") : "en_US-amy-medium" });
  } catch (e) { return { error: (e as Error).message }; }
  audit({ actorId: u.id, actorKind: "user", action: "settings:ai", outcome: "ok" });
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

export async function saveProfile(_: Result, f: FormData): Promise<Result> {
  const u = await requireUser();
  const theme = str(f, "theme");
  updateProfile(u.id, { name: str(f, "name"), prefs: { theme: (["light", "dark"].includes(theme) ? theme : "system") as "system", reduceMotion: f.get("reduceMotion") === "on", proactive: f.get("proactive") === "on",
    notify: { bills: f.get("n_bills") === "on", packages: f.get("n_packages") === "on", maintenance: f.get("n_maintenance") === "on", reminders: f.get("n_reminders") === "on", security: f.get("n_security") === "on" } } });
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

export async function changeSecrets(_: Result, f: FormData): Promise<Result> {
  const u = await requireUser();
  if (!(await verifySecret(u.id, str(f, "current")))) return { error: "Current password is incorrect." };
  const pw = String(f.get("password") ?? ""), pin = str(f, "pin");
  if (pw && pw.length < 10) return { error: "New password must be at least 10 characters." };
  if (pin && !/^\d{4,8}$/.test(pin)) return { error: "PIN must be 4–8 digits." };
  if (pw) await setPassword(u.id, pw);
  if (pin) await setPin(u.id, pin);
  if (f.get("clear_pin") === "on") await setPin(u.id, null);
  audit({ actorId: u.id, actorKind: "user", action: "auth:change_credentials", outcome: "ok", detail: { password: !!pw, pin: !!pin } });
  return { ok: true, message: "Updated." };
}

export async function invitePartner(_: Result, f: FormData): Promise<Result> {
  const u = await requireAdmin();
  const pw = String(f.get("password") ?? "");
  if (pw.length < 10) return { error: "Temporary password must be at least 10 characters." };
  try {
    await createUser({ name: str(f, "name"), email: str(f, "email"), password: pw, role: f.get("admin") === "on" ? "admin" : "member" });
  } catch (e) { return { error: /UNIQUE/.test(String(e)) ? "That email is already in use." : (e as Error).message }; }
  audit({ actorId: u.id, actorKind: "user", action: "users:create", target: str(f, "email"), outcome: "ok" });
  revalidatePath("/settings");
  return { ok: true, message: "Profile created. Share the temporary password in person." };
}

export async function backupNow(): Promise<Result> {
  const u = await requireAdmin();
  if (!(await isElevated())) return { error: "elevate" };
  const b = await runBackup("manual");
  audit({ actorId: u.id, actorKind: "user", action: "backup:create", target: b.name, outcome: "ok" });
  revalidatePath("/system");
  return { ok: true, message: `Backup ${b.name} created (${b.sizeMb} MB).` };
}
