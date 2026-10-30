import { ModulePage } from "@/components/module-page";

export default async function Planner({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  return <ModulePage base="/planner" title="Planner" subtitle="Your shared life, in one place." tab={(await searchParams).tab} tabs={[
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
