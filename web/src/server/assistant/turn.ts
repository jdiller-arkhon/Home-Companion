import { env } from "../env";
import { getSettings } from "../settings";
import { snapshot, briefingLines } from "../briefing";
import { memoriesFor } from "./memory";
import { toolSpecs } from "./tools";
import { addMessage, createConversation, getConversation, messages } from "./conversations";
import { log } from "../log";
import type { User } from "../users";

export type TurnEvent = { type: string; [k: string]: unknown };

/**
 * One assistant turn: persists history, asks the brain (local model) and
 * streams its events. Shared by the in-app chat and Siri Shortcuts so both
 * go through the same tool gateway and approval policy.
 */
export async function* assistantTurn(user: User, message: string, conversationId: string | undefined, signal?: AbortSignal): AsyncGenerator<TurnEvent> {
  const conv = conversationId ? getConversation(user.id, conversationId) : createConversation(user.id, message);
  if (!conv) throw new Error("Conversation not found");
  yield { type: "conversation", id: conv.id };

  const history = messages(conv.id, 30).map((m) => ({ role: m.role === "tool" ? "assistant" : m.role, content: m.content }));
  addMessage(conv.id, "user", message);
  const s = getSettings();
  const briefing = briefingLines(await snapshot(user.id));
  const payload = {
    user: { id: user.id, name: user.name }, conversation_id: conv.id, household: s.household_name, assistant_name: s.assistant_name,
    now: new Date().toLocaleString("en-US", { timeZone: s.timezone, dateStyle: "full", timeStyle: "short" }), timezone: s.timezone,
    briefing, memories: memoriesFor(user.id).slice(0, 40).map((m) => m.content), history, message, tools: toolSpecs(),
    models: { local: s.ai_endpoint, remote: s.ai_remote_endpoint || null, prefer_remote: s.ai_prefer_remote, model: s.ai_model },
  };

  let text = "";
  const toolEvents: unknown[] = [];
  try {
    const r = await fetch(`${env().brainUrl}/chat`, {
      method: "POST", body: JSON.stringify(payload), signal,
      headers: { "Content-Type": "application/json", "X-Hearth-Token": env().serviceToken },
    });
    if (!r.ok || !r.body) throw new Error(`brain HTTP ${r.status}`);
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        const ev = JSON.parse(line) as TurnEvent;
        if (ev.type === "token") text += ev.text as string;
        if (ev.type === "tool") toolEvents.push(ev);
        yield ev;
      }
    }
  } catch (e) {
    if (!signal?.aborted) {
      log.warn("assistant.brain_unavailable", { error: String(e) });
      const fallback = "The assistant's AI service isn't reachable right now, so here's your briefing instead:\n\n" + briefing.map((l) => `• ${l}`).join("\n");
      text = fallback;
      yield { type: "token", text: fallback };
      yield { type: "error", message: "AI service offline. Check System for details." };
    }
  }
  if (text) addMessage(conv.id, "assistant", text, { tools: toolEvents });
  yield { type: "done" };
}
