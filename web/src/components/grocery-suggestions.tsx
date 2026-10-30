"use client";
import { useTransition } from "react";
import { Plus } from "lucide-react";
import { quickAddGrocery } from "@/server/meal-actions";

export function GrocerySuggestions({ items }: { items: { title: string; everyDays: number; lastDaysAgo: number }[] }) {
  const [pending, start] = useTransition();
  if (!items.length) return null;
  return (
    <section className="rise">
      <p className="eyebrow">You usually buy these about now</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((i) => (
          <button key={i.title} disabled={pending} onClick={() => start(() => quickAddGrocery(i.title))} title={`Every ~${i.everyDays} days · last ${i.lastDaysAgo} days ago`}
            className="press inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[13px] hover:bg-fill">
            <Plus size={13} className="text-fg-3" />{i.title}<span className="text-[11px] text-fg-3">{i.lastDaysAgo}d</span>
          </button>
        ))}
      </div>
    </section>
  );
}
