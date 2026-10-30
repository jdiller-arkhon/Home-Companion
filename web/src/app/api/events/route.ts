import { getCurrentUser } from "@/server/auth";
import { bus, type ChangeEvent } from "@/server/events";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(ctl) {
      const send = (e: ChangeEvent) => {
        // Private action topics only go to their owner.
        if (e.topic.startsWith("actions:") && e.topic !== `actions:${user.id}`) return;
        ctl.enqueue(enc.encode(`data: ${JSON.stringify({ topic: e.topic })}\n\n`));
      };
      const ping = setInterval(() => ctl.enqueue(enc.encode(": ping\n\n")), 25_000);
      bus().on("change", send);
      cleanup = () => { clearInterval(ping); bus().off("change", send); };
      req.signal.addEventListener("abort", () => { cleanup(); try { ctl.close(); } catch {} });
    },
    cancel() { cleanup(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
