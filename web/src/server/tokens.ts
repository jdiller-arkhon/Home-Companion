import { db } from "./db/client";
import { newId } from "./ids";
import { randomToken, sha256 } from "./crypto";
import { getUser, type User } from "./users";

/**
 * Scoped bearer tokens. The secret is shown once and only its hash is kept.
 *  calendar – read-only ICS feed for one person (their private + shared items)
 *  shortcut – Siri/Shortcuts: low-risk commands only (anything sensitive is queued for approval in the app)
 *  share    – time-limited, read-only emergency card for a house-sitter
 */
export type TokenKind = "calendar" | "shortcut" | "share";
export type Token = { id: string; user_id: string; kind: TokenKind; name: string; expires_at: number | null; last_used_at: number | null; created_at: number };

export function issueToken(userId: string, kind: TokenKind, name: string, expiresAt: number | null = null): { token: Token; secret: string } {
  const secret = `${kind.slice(0, 3)}_${randomToken(24)}`;
  const t: Token = { id: newId(), user_id: userId, kind, name: name.slice(0, 60), expires_at: expiresAt, last_used_at: null, created_at: Date.now() };
  db().prepare("INSERT INTO api_tokens (id,user_id,kind,name,token_hash,expires_at,created_at) VALUES (?,?,?,?,?,?,?)")
    .run(t.id, userId, kind, t.name, sha256(secret), expiresAt, t.created_at);
  return { token: t, secret };
}

export function listTokens(userId: string, kind?: TokenKind): Token[] {
  return db().prepare("SELECT id,user_id,kind,name,expires_at,last_used_at,created_at FROM api_tokens WHERE user_id=? AND (? IS NULL OR kind=?) ORDER BY created_at DESC")
    .all(userId, kind ?? null, kind ?? null) as Token[];
}

export function revokeToken(userId: string, id: string) {
  db().prepare("DELETE FROM api_tokens WHERE id=? AND user_id=?").run(id, userId);
}

/** Resolves a presented secret to its user, enforcing kind and expiry. */
export function authenticateToken(secret: string | null | undefined, kind: TokenKind): { user: User; token: Token } | null {
  if (!secret || secret.length > 100) return null;
  const t = db().prepare("SELECT id,user_id,kind,name,expires_at,last_used_at,created_at FROM api_tokens WHERE token_hash=? AND kind=?").get(sha256(secret), kind) as Token | undefined;
  if (!t || (t.expires_at && t.expires_at < Date.now())) return null;
  const user = getUser(t.user_id);
  if (!user) return null;
  db().prepare("UPDATE api_tokens SET last_used_at=? WHERE id=?").run(Date.now(), t.id);
  return { user, token: t };
}

export function bearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7).trim() : null;
}
