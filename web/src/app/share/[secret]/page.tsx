import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { authenticateToken } from "@/server/tokens";
import { getEmergency, wifiPassword } from "@/server/emergency";
import { getSettings } from "@/server/settings";
import { audit } from "@/server/audit";
import { EmergencyCard } from "@/components/emergency-card";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Emergency info", robots: { index: false, follow: false } };

/** Public, read-only, expiring view of the emergency card for a house-sitter. Shows nothing else. */
export default async function Shared({ params }: { params: Promise<{ secret: string }> }) {
  const auth = authenticateToken((await params).secret, "share");
  if (!auth) notFound();
  audit({ actorId: auth.user.id, actorKind: "system", action: "emergency:shared_view", target: auth.token.name, outcome: "ok" });
  const values = getEmergency();
  return (
    <div className="mx-auto max-w-[760px] px-5 py-12">
      <p className="eyebrow">{getSettings().household_name}</p>
      <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.03em]">Emergency info</h1>
      <p className="mt-1 mb-8 text-[14px] text-fg-2">Shared by {auth.user.name}{auth.token.expires_at ? ` · available until ${new Date(auth.token.expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric" })}` : ""}. In an emergency, call 911 first.</p>
      <EmergencyCard values={values} wifi={values.share_wifi === "on" ? wifiPassword() : null} />
    </div>
  );
}
