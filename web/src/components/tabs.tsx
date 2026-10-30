import Link from "next/link";
import clsx from "clsx";

export function Tabs({ base, tabs, active }: { base: string; tabs: { key: string; label: string; count?: number }[]; active: string }) {
  return (
    <nav className="rise -mx-1 mt-6 flex gap-1 overflow-x-auto border-b border-line pb-px" aria-label="Sections">
      {tabs.map((t) => (
        <Link key={t.key} href={`${base}?tab=${t.key}`} scroll={false} aria-current={t.key === active ? "page" : undefined}
          className={clsx("relative whitespace-nowrap px-3 py-2.5 text-[13px] transition-colors", t.key === active ? "text-fg font-medium" : "text-fg-3 hover:text-fg")}>
          {t.label}{t.count ? <span className="ml-1.5 tnum text-fg-3">{t.count}</span> : null}
          {t.key === active && <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-fg" />}
        </Link>
      ))}
    </nav>
  );
}
