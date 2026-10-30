"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSession, destroySession, rateLimit } from "./auth";
import { createUser, userCount, verifyPassword } from "./users";
import { updateSettings } from "./settings";
import { audit } from "./audit";

export type FormState = { error?: string };

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const ip = (await headers()).get("x-forwarded-for") ?? "local";
  if (!rateLimit(`login:${ip}`)) return { error: "Too many attempts. Try again in 15 minutes." };
  const user = await verifyPassword(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  if (!user) {
    audit({ actorId: null, actorKind: "user", action: "auth:login", outcome: "denied", detail: { email: form.get("email") } });
    return { error: "That email and password don't match." };
  }
  await createSession(user.id);
  audit({ actorId: user.id, actorKind: "user", action: "auth:login", outcome: "ok" });
  redirect("/");
}

export async function signOut() {
  await destroySession();
  redirect("/login");
}

export async function setupHousehold(_: FormState, form: FormData): Promise<FormState> {
  if (userCount() > 0) return { error: "This household is already set up." };
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!name || !/^\S+@\S+$/.test(email)) return { error: "Enter your name and email." };
  if (password.length < 10) return { error: "Use a password of at least 10 characters." };
  const user = await createUser({ name, email, password, role: "admin" });
  updateSettings({ household_name: String(form.get("household") || "Our Home").trim(), onboarded: true });
  audit({ actorId: user.id, actorKind: "user", action: "household:setup", outcome: "ok" });
  await createSession(user.id);
  redirect("/");
}
