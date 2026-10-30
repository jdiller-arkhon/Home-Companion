import { db } from "../db/client";
import { newId } from "../ids";

export type Conv = { id: string; user_id: string; title: string; created_at: number; updated_at: number };
export type Msg = { id: string; conversation_id: string; role: "user" | "assistant" | "tool"; content: string; meta: string; created_at: number };

export function listConversations(userId: string): Conv[] {
  return db().prepare("SELECT * FROM conversations WHERE user_id=? ORDER BY updated_at DESC LIMIT 50").all(userId) as Conv[];
}

export function getConversation(userId: string, id: string): Conv | null {
  return (db().prepare("SELECT * FROM conversations WHERE id=? AND user_id=?").get(id, userId) as Conv) ?? null;
}

export function createConversation(userId: string, firstMessage: string): Conv {
  const c = { id: newId(), user_id: userId, title: firstMessage.slice(0, 60), created_at: Date.now(), updated_at: Date.now() };
  db().prepare("INSERT INTO conversations VALUES (?,?,?,?,?)").run(c.id, c.user_id, c.title, c.created_at, c.updated_at);
  return c;
}

export function messages(conversationId: string, limit = 200): Msg[] {
  return (db().prepare("SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at DESC LIMIT ?").all(conversationId, limit) as Msg[]).reverse();
}

export function addMessage(conversationId: string, role: Msg["role"], content: string, meta: Record<string, unknown> = {}) {
  db().prepare("INSERT INTO messages VALUES (?,?,?,?,?,?)").run(newId(), conversationId, role, content, JSON.stringify(meta), Date.now());
  db().prepare("UPDATE conversations SET updated_at=? WHERE id=?").run(Date.now(), conversationId);
}

export function deleteConversation(userId: string, id: string) {
  db().prepare("DELETE FROM conversations WHERE id=? AND user_id=?").run(id, userId);
}
