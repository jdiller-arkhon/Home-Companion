import { getCurrentUser } from "@/server/auth";
import { brain } from "@/server/brain-proxy";

export async function GET() {
  if (!(await getCurrentUser())) return new Response("Unauthorized", { status: 401 });
  try { return Response.json(await (await brain("/voices", { timeoutMs: 3000 })).json()); }
  catch { return Response.json({ voices: [], error: "The voice service isn't running." }); }
}
