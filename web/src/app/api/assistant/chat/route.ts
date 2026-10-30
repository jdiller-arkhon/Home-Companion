import { z } from "zod";
import { getCurrentUser, assertSameOrigin } from "@/server/auth";
import { env } from "@/server/env";
import { getSettings } from "@/server/settings";
import { snapshot, briefingLines } from "@/server/briefing";
import { memoriesFor } from "@/server/assistant/memory";
import { toolSpecs } from "@/server/assistant/tools";
import { addMessage, createConversation, getConversation, messages } from "@/server/assistant/conversations";
import { log } from "@/server/log";

export const dynamic = "force-dynamic";

const Body = z.object({ conversationId: z.string().optional(), message: z.string().min(1).max(4000) });

/**
 * Streams an assistant turn. The web app owns identity, history and context;
 * the Python brain owns model reasoning and calls back into
 * /api/internal/tools to *request* actions, which this app's policy gates.
 */
export async function POST(req: Request) {
  try { await assertSameOrigin(req); } catch (r) { return r as Response; }
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("Bad request", { status: 400 });
  const { message } = parsed.data;
  const conv = parsed.data.conversationId ? getConversation(user.id, parsed.data.conversationId) : createConversation(user.id, message);
  if (!conv) return new Response("Not found", { status: 404 });

  const history = messages(conv.id, 30).map((m) => ({ role: m.role === "tool" ? "assistant" : m.role, content: m.content }));
  addMessage(conv.id, "user", message);
  const s = getSettings();
  const snap = await snapshot(user.id);

  const payload = {
    user: { id: user.id, name: user.name }, conversation_id: conv.id, household: s.household_name, assistant_name: s.assistant_name,
    now: new Date().toLocaleString("en-US", { timeZone: s.timezone, dateStyle: "full", timeStyle: "short" }), timezone: s.timezone,
    briefing: briefingLines(snap), memories: memoriesFor(user.id).slice(0, 40).map((m) => m.content),
    history, message, tools: toolSpecs(),
    models: { local: s.ai_endpoint, remote: s.ai_remote_endpoint || null, prefer_remote: s.ai_prefer_remote, model: s.ai_model },
  };

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctl) {
      const send = (o: unknown) => ctl.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
      send({ type: "conversation", id: conv.id });
      let text = "";
      const toolEvents: unknown[] = [];
      try {
        const r = await fetch(`${env().brainUrl}/chat`, {
          method: "POST", body: JSON.stringify(payload), signal: req.signal,
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
            const ev = JSON.parse(line);
            if (ev.type === "token") text += ev.text;
            if (ev.type === "tool") toolEvents.push(ev);
            send(ev);
          }
        }
      } catch (e) {
        if (!req.signal.aborted) {
          log.warn("assistant.brain_unavailable", { error: String(e) });
          const fallback = "The assistant's AI service isn't reachable right now, so here's your briefing instead:\n\n" + payload.briefing.map((l) => `• ${l}`).join("\n");
          text = fallback;
          send({ type: "token", text: fallback });
          send({ type: "error", message: "AI service offline. Check System for details." });
        }
      }
      if (text) addMessage(conv.id, "assistant", text, { tools: toolEvents });
      send({ type: "done" });
      ctl.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" } });
}
