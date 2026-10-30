import { requireUser } from "@/server/auth";
import { EMERGENCY_FIELDS, getEmergency, wifiPassword } from "@/server/emergency";
import { listTokens } from "@/server/tokens";
import { EmergencyCard } from "@/components/emergency-card";
import { EmergencyForm } from "@/components/emergency-form";
import { ShareLinks } from "@/components/share-tokens";
import { PageHeader } from "@/components/ui";
import { Tabs } from "@/components/tabs";

const day = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default async function Emergency({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const tab = (await searchParams).tab ?? "card";
  const values = getEmergency();
  const wifi = wifiPassword();
  const shares = listTokens(user.id, "share").filter((t) => !t.expires_at || t.expires_at > Date.now())
    .map((t) => ({ id: t.id, name: t.name, created: day(t.created_at), lastUsed: t.last_used_at ? day(t.last_used_at) : null, expires: t.expires_at ? day(t.expires_at) : null }));
  return (
    <div className="mx-auto max-w-[860px] px-5 md:px-10 pt-10 md:pt-14 pb-12">
      <PageHeader title="Emergency card" subtitle="Everything someone needs if you're not there." />
      <Tabs base="/emergency" active={tab} tabs={[{ key: "card", label: "Card" }, { key: "edit", label: "Edit" }, { key: "share", label: "Share with a sitter" }]} />
      <div className="mt-6">
        {tab === "edit" ? <EmergencyForm fields={EMERGENCY_FIELDS} values={values} hasWifi={!!wifi} />
          : tab === "share" ? <ShareLinks tokens={shares} />
          : Object.keys(values).filter((k) => k !== "share_wifi").length ? <EmergencyCard values={values} wifi={wifi} />
          : <p className="rounded-[var(--radius)] border border-dashed border-line py-10 text-center text-[13px] text-fg-3">Nothing here yet — fill it in under Edit.</p>}
      </div>
    </div>
  );
}
