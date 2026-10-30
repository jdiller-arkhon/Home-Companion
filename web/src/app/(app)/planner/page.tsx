import { ModulePage } from "@/components/module-page";
import { MonthView } from "@/components/month";
import { GrocerySuggestions } from "@/components/grocery-suggestions";
import { requireUser } from "@/server/auth";
import { listItems } from "@/server/items/repo";
import { regulars } from "@/lib/groceries";

async function Suggestions() {
  const u = await requireUser();
  const all = listItems(u.id, { kind: "grocery", limit: 5000 });
  const done = all.filter((g) => g.status === "done").map((g) => ({ title: g.title, completedAt: Number(g.data.last_done ?? g.updated_at) }));
  return <GrocerySuggestions items={regulars(done, all.filter((g) => g.status === "open").map((g) => g.title), Date.now())} />;
}

export default async function Planner({ searchParams }: { searchParams: Promise<{ tab?: string; m?: string }> }) {
  const sp = await searchParams;
  return <ModulePage base="/planner" title="Planner" subtitle="Your shared life, in one place." tab={sp.tab}
    before={(k) => (k === "agenda" ? <MonthView month={sp.m} /> : k === "groceries" ? <Suggestions /> : null)} tabs={[
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
