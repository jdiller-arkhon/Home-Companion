import { z } from "zod";
import { env } from "@/server/env";
import { timingSafeEqualStr } from "@/server/crypto";
import { executeTool } from "@/server/assistant/tools";
import { getUser } from "@/server/users";
import { getConversation } from "@/server/assistant/conversations";

const Body = z.object({ name: z.string(), args: z.unknown(), user_id: z.string(), conversation_id: z.string(), tainted: z.boolean() });

/**
 * Tool gateway for the brain service. Authenticated by a shared service token
 * and only valid for an existing conversation owned by the stated user, so the
 * brain can never act for someone who didn't start the conversation.
 */
export async function POST(req: Request) {
  const token = req.headers.get("x-hearth-token") ?? "";
  if (!timingSafeEqualStr(token, env().serviceToken)) return new Response("Forbidden", { status: 403 });
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return Response.json({ status: "error", error: "Bad request" }, { status: 400 });
  if (!getUser(b.data.user_id) || !getConversation(b.data.user_id, b.data.conversation_id)) return Response.json({ status: "error", error: "Unknown user or conversation" }, { status: 403 });
  const r = await executeTool(b.data.name, b.data.args, { userId: b.data.user_id, conversationId: b.data.conversation_id, tainted: b.data.tainted });
  return Response.json(r);
}
