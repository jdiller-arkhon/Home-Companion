import { db } from "./db/client";
import { log } from "./log";

export type AuditEntry = {
  actorId: string | null;
  actorKind: "user" | "assistant" | "system";
  action: string;
  target?: string | null;
  outcome: "ok" | "denied" | "pending" | "failed";
  detail?: Record<string, unknown>;
};

const REDACT = /(password|pin|token|secret|key)/i;

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, REDACT.test(k) ? "[redacted]" : redact(v)]),
    );
  }
  return value;
}

export function audit(e: AuditEntry) {
  const detail = JSON.stringify(redact(e.detail ?? {}));
  db()
    .prepare("INSERT INTO audit_log (ts, actor_id, actor_kind, action, target, outcome, detail) VALUES (?,?,?,?,?,?,?)")
    .run(Date.now(), e.actorId, e.actorKind, e.action, e.target ?? null, e.outcome, detail);
  log.info("audit", { action: e.action, actor: e.actorKind, outcome: e.outcome, target: e.target });
}

export type AuditRow = {
  id: number; ts: number; actor_id: string | null; actor_kind: string; action: string;
  target: string | null; outcome: string; detail: string; actor_name: string | null;
};

export function recentAudit(limit = 100, before?: number): AuditRow[] {
  return db()
    .prepare(
      `SELECT a.*, u.name AS actor_name FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
       WHERE (? IS NULL OR a.id < ?) ORDER BY a.id DESC LIMIT ?`,
    )
    .all(before ?? null, before ?? null, limit) as AuditRow[];
}
