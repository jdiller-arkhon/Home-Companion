import { getCurrentUser, assertSameOrigin } from "@/server/auth";
import { getSettings } from "@/server/settings";
import { brain } from "@/server/brain-proxy";

/** Text-to-speech on local Piper. */
export async function POST(req: Request) {
  try { await assertSameOrigin(req); } catch (r) { return r as Response; }
  if (!(await getCurrentUser())) return new Response("Unauthorized", { status: 401 });
  const { text, voice } = (await req.json().catch(() => ({}))) as { text?: string; voice?: string };
  if (!text) return new Response("Bad request", { status: 400 });
  try {
    const r = await brain("/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.slice(0, 2000), voice: voice ?? getSettings().assistant_voice }) });
    if (!r.ok) return Response.json({ error: (await r.json().catch(() => ({}))).detail ?? "Speech failed" }, { status: r.status });
    return new Response(await r.arrayBuffer(), { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "The voice service isn't running." }, { status: 503 });
  }
}
