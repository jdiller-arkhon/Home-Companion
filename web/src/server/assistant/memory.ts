import { db } from "../db/client";
import { newId } from "../ids";

export type Memory = { id: string; user_id: string | null; content: string; source: string; created_at: number };

export function addMemory(userId: string | null, content: string, source: "assistant" | "user"): Memory {
  const m = { id: newId(), user_id: userId, content: content.trim(), source, created_at: Date.now() };
  db().prepare("INSERT INTO memories VALUES (?,?,?,?,?)").run(m.id, m.user_id, m.content, m.source, m.created_at);
  return m;
}

/** Household memories plus the viewer's own; never the other person's private ones. */
export function memoriesFor(userId: string): Memory[] {
  return db().prepare("SELECT * FROM memories WHERE user_id IS NULL OR user_id = ? ORDER BY created_at DESC LIMIT 200").all(userId) as Memory[];
}

export function deleteMemory(userId: string, id: string) {
  db().prepare("DELETE FROM memories WHERE id = ? AND (user_id IS NULL OR user_id = ?)").run(id, userId);
}
