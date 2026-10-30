import { getCurrentUser, isElevated, assertSameOrigin } from "@/server/auth";
import { resolveAction } from "@/server/assistant/tools";

/** A person approves or rejects an action the assistant proposed. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await assertSameOrigin(req); } catch (r) { return r as Response; }
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { approve } = (await req.json().catch(() => ({}))) as { approve?: boolean };
  const r = await resolveAction(user.id, (await params).id, !!approve, await isElevated());
  return Response.json(r);
}
