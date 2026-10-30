import { authenticateToken } from "@/server/tokens";
import { feedFor } from "@/server/calendar";
import { getSettings } from "@/server/settings";

/** Read-only iCal feed. The unguessable token in the URL is the credential; revoke it in Settings. */
export async function GET(_: Request, { params }: { params: Promise<{ secret: string }> }) {
  const secret = (await params).secret.replace(/\.ics$/, "");
  const auth = authenticateToken(secret, "calendar");
  if (!auth) return new Response("Not found", { status: 404 });
  return new Response(feedFor(auth.user.id, `${getSettings().household_name} · ${auth.user.name}`), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300", "X-Robots-Tag": "noindex" },
  });
}
