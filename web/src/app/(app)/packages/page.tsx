import { ModulePage } from "@/components/module-page";

export default async function Packages({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  return <ModulePage base="/packages" title="Packages" subtitle="Everything on its way to your door." tab={(await searchParams).tab} tabs={[
    { key: "all", label: "Deliveries", kinds: ["package"], empty: { package: "Nothing on the way. Add a package to track its arrival." } },
  ]} />;
}
