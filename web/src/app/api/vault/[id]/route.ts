import { getCurrentUser } from "@/server/auth";
import { readDocBytes } from "@/server/vault";
import { audit } from "@/server/audit";

/** Decrypts and streams a document to an authorised household member. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const r = readDocBytes(user.id, id);
  if (!r) return new Response("Not found", { status: 404 });
  audit({ actorId: user.id, actorKind: "user", action: "vault:export", target: r.doc.name, outcome: "ok" });
  return new Response(new Uint8Array(r.bytes), { headers: {
    "Content-Type": r.doc.mime, "Content-Disposition": `attachment; filename="${encodeURIComponent(r.doc.name)}"`,
    "Cache-Control": "private, no-store", "Content-Security-Policy": "sandbox", "X-Content-Type-Options": "nosniff",
  } });
}
