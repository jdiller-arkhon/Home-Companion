import { ModulePage } from "@/components/module-page";

export default async function Maintenance({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  return <ModulePage base="/maintenance" title="Upkeep" subtitle="Appliances, vehicles and everything that keeps the house running." tab={(await searchParams).tab} tabs={[
    { key: "schedule", label: "Schedule", kinds: ["maintenance"] },
    { key: "appliances", label: "Appliances", kinds: ["appliance"] },
    { key: "vehicles", label: "Vehicles", kinds: ["vehicle"] },
    { key: "repairs", label: "Repairs", kinds: ["repair"] },
    { key: "supplies", label: "Supplies", kinds: ["consumable"] },
  ]} />;
}
