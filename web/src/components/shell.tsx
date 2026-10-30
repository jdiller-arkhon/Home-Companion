"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Sparkles, Lightbulb, CalendarDays, MonitorSmartphone, Siren, BarChart3, Wrench, Lock, Package, Activity, Settings } from "lucide-react";
import clsx from "clsx";
import { NotificationBell } from "./notifications";
import { motion } from "motion/react";
import { spring } from "./motion";

const NAV = [
  { href: "/", label: "Today", icon: Home },
  { href: "/assistant", label: "Assistant", icon: Sparkles, ai: true },
  { href: "/devices", label: "Home", icon: Lightbulb },
  { href: "/planner", label: "Planner", icon: CalendarDays },
  { href: "/maintenance", label: "Upkeep", icon: Wrench },
  { href: "/vault", label: "Vault", icon: Lock },
  { href: "/packages", label: "Packages", icon: Package },
  { href: "/emergency", label: "Emergency", icon: Siren },
  { href: "/report", label: "Year in review", icon: BarChart3 },
  { href: "/system", label: "System", icon: Activity },
];
const MOBILE = ["/", "/assistant", "/devices", "/planner", "/maintenance"];

type N = React.ComponentProps<typeof NotificationBell>;

export function Shell({ user, household, children, notifications }: { user: { name: string }; household: string; children: React.ReactNode; notifications: N }) {
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
            <Link key={href} href={href} className={clsx("press relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] transition-colors",
              active(href) ? "text-fg font-medium" : "text-fg-2 hover:text-fg")}>
              {active(href) && <motion.span layoutId="nav-pill" transition={spring} className="absolute inset-0 rounded-lg bg-fill" style={{ boxShadow: "inset 0 0 0 1px var(--line)" }} />}
              <Icon size={16} strokeWidth={1.75} className={clsx("relative", ai && "text-accent")} /><span className="relative">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2.5 rounded-lg px-2.5 py-2">
          <div className="size-7 rounded-full bg-accent-soft text-accent grid place-items-center text-[12px] font-semibold">{user.name[0]}</div>
          <span className="text-[13px] text-fg-2 flex-1 truncate">{user.name}</span>
          <NotificationBell {...notifications} />
          <Link href="/settings" aria-label="Settings" className="text-fg-3 hover:text-fg"><Settings size={16} strokeWidth={1.75} /></Link>
        </div>
        <Link href="/display" className="mt-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-fg-3 hover:bg-fill hover:text-fg"><MonitorSmartphone size={15} strokeWidth={1.75} />Display mode</Link>
      </aside>
      <main className="pb-24 md:pb-0">
        <div className="md:hidden flex items-center justify-end gap-3 px-5 pt-[max(env(safe-area-inset-top),12px)]">
          <NotificationBell {...notifications} />
          <Link href="/settings" aria-label="Settings" className="text-fg-3"><Settings size={17} strokeWidth={1.75} /></Link>
        </div>
        {children}
      </main>
      <nav className="glass md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-line grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {NAV.filter((n) => MOBILE.includes(n.href)).map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={clsx("relative flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors", active(href) ? "text-fg" : "text-fg-3")}>
            {active(href) && <motion.span layoutId="tab-dot" transition={spring} className="absolute top-1 h-[3px] w-5 rounded-full bg-fg" />}
            <motion.span whileTap={{ scale: 0.86 }} className="grid place-items-center"><Icon size={20} strokeWidth={1.75} /></motion.span>{label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
