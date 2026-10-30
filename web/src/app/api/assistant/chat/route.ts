import { z } from "zod";
import { getCurrentUser, assertSameOrigin } from "@/server/auth";
import { assistantTurn } from "@/server/assistant/turn";

export const dynamic = "force-dynamic";

const Body = z.object({ conversationId: z.string().optional(), message: z.string().min(1).max(4000) });

/** Streams an assistant turn to the in-app chat as server-sent events. */
export async function POST(req: Request) {
  try { await assertSameOrigin(req); } catch (r) { return r as Response; }
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response("Bad request", { status: 400 });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctl) {
      try {
        for await (const ev of assistantTurn(user, parsed.data.message, parsed.data.conversationId, req.signal)) ctl.enqueue(enc.encode(`data: ${JSON.stringify(ev)}\n\n`));
      } catch (e) {
        ctl.enqueue(enc.encode(`data: ${JSON.stringify({ type: "error", message: (e as Error).message })}\n\n`));
      }
      ctl.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" } });
}
