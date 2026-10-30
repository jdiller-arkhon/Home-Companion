"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import clsx from "clsx";

export function Sheet({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay data-sheet-overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[3px]" />
        <Dialog.Content data-sheet className="fixed z-50 inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[22px] border border-line bg-elev p-6 pb-[max(env(safe-area-inset-bottom),24px)] shadow-[0_-12px_48px_-16px_rgb(0_0_0/0.35)] md:inset-auto md:left-1/2 md:top-1/2 md:w-[480px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[20px] md:pb-6">
          <div className="mx-auto -mt-2 mb-4 h-1 w-9 rounded-full bg-fill md:hidden" style={{ background: "var(--line-strong)" }} aria-hidden />
          <div className="flex items-start">
            <div>
              <Dialog.Title className="text-[18px] font-semibold tracking-tight">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-1 text-[13px] text-fg-2">{description}</Dialog.Description>}
            </div>
            <Dialog.Close className="ml-auto -mr-1 rounded-md p-1 text-fg-3 hover:text-fg" aria-label="Close"><X size={18} /></Dialog.Close>
          </div>
          <div className="mt-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Button({ variant = "primary", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return <button {...p} className={clsx("press inline-flex items-center justify-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[13px] font-medium disabled:opacity-50", {
    primary: "bg-fg text-bg hover:opacity-90",
    secondary: "border border-line bg-elev hover:bg-fill",
    ghost: "text-fg-2 hover:text-fg hover:bg-fill",
    danger: "text-bad hover:bg-fill",
  }[variant], className)} />;
}

export const inputCls = "w-full rounded-[10px] border border-line bg-elev px-3 py-2 text-[14px] outline-none transition focus:border-fg-3 focus:ring-4 focus:ring-fill";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end gap-4 rise">
      <div>
        <h1 className="text-[30px] md:text-[34px] font-semibold tracking-[-0.03em] leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-fg-2">{subtitle}</p>}
      </div>
      <div className="ml-auto flex gap-2">{children}</div>
    </header>
  );
}

export function Pill({ tone = "neutral", children }: { tone?: "neutral" | "ok" | "warn" | "bad" | "accent"; children: React.ReactNode }) {
  return <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", {
    neutral: "bg-fill text-fg-2", ok: "bg-ok/10 text-ok", warn: "bg-warn/10 text-warn", bad: "bg-bad/10 text-bad", accent: "bg-accent-soft text-accent",
  }[tone])}>{children}</span>;
}
