"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Sparkles, Lightbulb, Wallet, CalendarDays, Wrench, Lock, Package, Activity, Settings } from "lucide-react";
import clsx from "clsx";

const NAV = [
  { href: "/", label: "Today", icon: Home },
  { href: "/assistant", label: "Assistant", icon: Sparkles, ai: true },
  { href: "/devices", label: "Home", icon: Lightbulb },
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/finance", label: "Finance", icon: Wallet },
  { href: "/maintenance", label: "Upkeep", icon: Wrench },
  { href: "/vault", label: "Vault", icon: Lock },
  { href: "/packages", label: "Packages", icon: Package },
  { href: "/system", label: "System", icon: Activity },
];
const MOBILE = ["/", "/assistant", "/devices", "/planner", "/finance"];

export function Shell({ user, household, children }: { user: { name: string }; household: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_1fr]">
      <aside className="hidden md:flex sticky top-0 h-dvh flex-col border-r border-line px-3 py-5">
        <div className="flex items-center gap-2.5 px-2.5 pb-6">
          <div className="size-6 rounded-[7px] bg-fg grid place-items-center"><div className="size-2 rounded-full bg-bg" /></div>
          <span className="text-[15px] font-semibold tracking-tight">{household}</span>
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon, ai }) => (
            <Link key={href} href={href} className={clsx("press flex items-center gap-3 rounded-lg px-2.5 py-2 text-[14px]",
              active(href) ? "bg-fill text-fg font-medium" : "text-fg-2 hover:text-fg hover:bg-fill")}>
              <Icon size={16} strokeWidth={1.75} className={ai ? "text-accent" : undefined} />{label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2.5 rounded-lg px-2.5 py-2">
          <div className="size-7 rounded-full bg-accent-soft text-accent grid place-items-center text-[12px] font-semibold">{user.name[0]}</div>
          <span className="text-[13px] text-fg-2 flex-1 truncate">{user.name}</span>
          <Link href="/settings" aria-label="Settings" className="text-fg-3 hover:text-fg"><Settings size={16} strokeWidth={1.75} /></Link>
        </div>
      </aside>
      <main className="pb-24 md:pb-0">{children}</main>
      <nav className="glass md:hidden fixed inset-x-0 bottom-0 border-t border-line grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {NAV.filter((n) => MOBILE.includes(n.href)).map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={clsx("flex flex-col items-center gap-1 py-2.5 text-[10px]", active(href) ? "text-fg" : "text-fg-3")}>
            <Icon size={20} strokeWidth={1.75} />{label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
