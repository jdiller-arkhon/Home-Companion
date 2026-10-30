import { ModulePage } from "@/components/module-page";
import { MonthView } from "@/components/month";

export default async function Planner({ searchParams }: { searchParams: Promise<{ tab?: string; m?: string }> }) {
  const sp = await searchParams;
  return <ModulePage base="/planner" title="Planner" subtitle="Your shared life, in one place." tab={sp.tab}
    before={(k) => (k === "agenda" ? <MonthView month={sp.m} /> : null)} tabs={[
    { key: "agenda", label: "Calendar", kinds: ["event"] },
    { key: "tasks", label: "Tasks", kinds: ["task", "errand"] },
    { key: "groceries", label: "Groceries", kinds: ["grocery"], empty: { grocery: "The list is empty. Add what you need." } },
    { key: "meals", label: "Meals", kinds: ["meal", "recipe"] },
    { key: "chores", label: "Chores", kinds: ["chore"] },
    { key: "occasions", label: "Occasions", kinds: ["occasion"] },
    { key: "notes", label: "Notes", kinds: ["note"] },
    { key: "goals", label: "Goals", kinds: ["goal"] },
  ]} />;
}
