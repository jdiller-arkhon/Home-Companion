"use server";
import { revalidatePath } from "next/cache";
import { requireUser, isElevated } from "./auth";
import { audit } from "./audit";
import { issueToken, revokeToken, type TokenKind } from "./tokens";

/** Creates a token and returns its secret once. Requires PIN — these grant access without a login. */
export async function createToken(kind: TokenKind, name: string, days?: number): Promise<{ secret?: string; error?: string }> {
  const u = await requireUser();
  if (!(await isElevated())) return { error: "elevate" };
  const exp = kind === "share" ? Date.now() + Math.min(Math.max(days ?? 7, 1), 60) * 86_400_000 : null;
  const { secret, token } = issueToken(u.id, kind, name || kind, exp);
  audit({ actorId: u.id, actorKind: "user", action: `token:create`, target: `${kind}:${token.name}`, outcome: "ok", detail: { expires: exp } });
  revalidatePath("/settings");
  revalidatePath("/emergency");
  return { secret };
}

export async function deleteToken(id: string) {
  const u = await requireUser();
  revokeToken(u.id, id);
  audit({ actorId: u.id, actorKind: "user", action: "token:revoke", target: id, outcome: "ok" });
  revalidatePath("/settings");
  revalidatePath("/emergency");
}
