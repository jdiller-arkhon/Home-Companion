import { getCurrentUser, assertSameOrigin } from "@/server/auth";
import { saveSubscription, removeSubscription, vapidPublicKey } from "@/server/push";
import { notify } from "@/server/notifications";

export async function GET() {
  if (!(await getCurrentUser())) return new Response("Unauthorized", { status: 401 });
  return Response.json({ publicKey: vapidPublicKey() });
}

export async function POST(req: Request) {
  try { await assertSameOrigin(req); } catch (r) { return r as Response; }
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const body = await req.json().catch(() => null);
  if (body?.unsubscribe) { removeSubscription(String(body.unsubscribe)); return Response.json({ ok: true }); }
  try { saveSubscription(user.id, body, req.headers.get("user-agent")); } catch (e) { return Response.json({ error: String(e) }, { status: 400 }); }
  await notify({ userId: user.id, category: "briefing", title: "Notifications are on", body: "You'll hear from Hearth about bills, deliveries and the house.", dedupeKey: `welcome-push:${body.endpoint}` });
  return Response.json({ ok: true });
}
