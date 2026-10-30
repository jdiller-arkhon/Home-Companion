import { ModulePage } from "@/components/module-page";
import { PasteEmail } from "@/components/paste-email";
import { people } from "@/server/records-view";

export default async function Packages({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  return <ModulePage base="/packages" title="Packages" subtitle="Everything on its way to your door." tab={(await searchParams).tab}
    actions={<PasteEmail people={people()} />} tabs={[
      { key: "all", label: "Deliveries", kinds: ["package"], empty: { package: "Nothing on the way. Add a package or paste a shipping email." } },
    ]} />;
}
