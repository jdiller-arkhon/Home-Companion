import { requireUser } from "@/server/auth";
import { kindDef } from "@/server/items/kinds";
import { rowsFor, people } from "@/server/records-view";
import { RecordBoard } from "./records";
import { Tabs } from "./tabs";
import { PageHeader } from "./ui";
import { Live } from "./live";

export type TabSpec = { key: string; kinds: string[]; label?: string; empty?: Record<string, string> };

/** A module = tabs of record kinds. Each tab can show one or more boards. */
export async function ModulePage({ base, title, subtitle, tabs, tab, before, actions }: { base: string; title: string; subtitle: string; tabs: TabSpec[]; tab?: string; before?: (activeKey: string) => Promise<React.ReactNode> | React.ReactNode; actions?: React.ReactNode }) {
  const user = await requireUser();
  const active = tabs.find((t) => t.key === tab) ?? tabs[0];
  const ppl = people();
  return (
    <div className="mx-auto max-w-[980px] px-5 md:px-10 pt-10 md:pt-14 pb-12">
      <Live />
      <PageHeader title={title} subtitle={subtitle}>{actions}</PageHeader>
      <Tabs base={base} active={active.key} tabs={tabs.map((t) => ({ key: t.key, label: t.label ?? kindDef(t.kinds[0]).plural }))} />
      {before && <div className="mt-6">{await before(active.key)}</div>}
      <div className="mt-6 space-y-10">
        {active.kinds.map((k) => (
          <RecordBoard key={k} kind={k} people={ppl} rows={rowsFor(user.id, k)}
            emptyText={active.empty?.[k] ?? `No ${kindDef(k).plural.toLowerCase()} yet — add the first one.`} />
        ))}
      </div>
    </div>
  );
}
