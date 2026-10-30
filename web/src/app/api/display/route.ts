import { getCurrentUser } from "@/server/auth";
import { getSettings } from "@/server/settings";
import { getDevice, haConfigured } from "@/server/integrations/homeassistant";

/** Lightweight poll for the display: is someone in front of the screen? */
export async function GET() {
  if (!(await getCurrentUser())) return new Response("Unauthorized", { status: 401 });
  const entity = getSettings().kiosk_motion_entity;
  if (!entity || !haConfigured()) return Response.json({ motion: null });
  const d = await getDevice(entity).catch(() => null);
  return Response.json({ motion: d ? d.state === "on" : null });
}
