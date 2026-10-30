import { getCurrentUser } from "@/server/auth";
import { readFloorImage } from "@/server/floorplan";

export async function GET() {
  if (!(await getCurrentUser())) return new Response("Unauthorized", { status: 401 });
  const img = readFloorImage();
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(img.bytes), { headers: { "Content-Type": img.mime, "Cache-Control": "private, max-age=3600" } });
}
