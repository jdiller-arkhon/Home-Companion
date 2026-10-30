import { getCurrentUser, assertSameOrigin } from "@/server/auth";
import { brain } from "@/server/brain-proxy";

/** Speech-to-text on local Whisper. Audio is never stored. */
export async function POST(req: Request) {
  try { await assertSameOrigin(req); } catch (r) { return r as Response; }
  if (!(await getCurrentUser())) return new Response("Unauthorized", { status: 401 });
  const form = await req.formData();
  const file = form.get("audio");
  if (!(file instanceof File) || file.size > 15 * 1024 * 1024) return Response.json({ error: "Invalid recording" }, { status: 400 });
  const out = new FormData();
  out.append("file", file, "speech");
  try {
    const r = await brain("/stt", { method: "POST", body: out });
    const j = await r.json();
    return r.ok ? Response.json(j) : Response.json({ error: j.detail ?? "Speech recognition failed" }, { status: r.status });
  } catch {
    return Response.json({ error: "The voice service isn't running." }, { status: 503 });
  }
}
