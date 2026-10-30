"use server";
import { requireUser, markElevated, rateLimit } from "./auth";
import { verifySecret } from "./users";
import { audit } from "./audit";

/** Step-up authentication: PIN or password unlocks sensitive actions for 5 minutes. */
export async function elevate(secret: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  if (!rateLimit(`elevate:${user.id}`, 6)) return { ok: false, error: "Too many attempts. Wait 15 minutes." };
  const ok = await verifySecret(user.id, secret);
  audit({ actorId: user.id, actorKind: "user", action: "auth:elevate", outcome: ok ? "ok" : "denied" });
  if (!ok) return { ok: false, error: "That PIN or password isn't right." };
  await markElevated();
  return { ok: true };
}
