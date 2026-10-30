"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import * as Popover from "@radix-ui/react-dropdown-menu";
import { Bell, BellRing } from "lucide-react";
import { readAll } from "@/server/notification-actions";

type N = { id: string; title: string; body: string; href: string | null; read: boolean; created_at: number };

export function NotificationBell({ items, unread }: { items: N[]; unread: number }) {
  const [, start] = useTransition();
  return (
    <Popover.Root onOpenChange={(o) => { if (!o && unread) start(() => readAll()); }}>
      <Popover.Trigger aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="press relative rounded-md p-1 text-fg-3 hover:text-fg">
        <Bell size={16} strokeWidth={1.75} />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">{unread}</span>}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={8} align="start" className="card z-50 max-h-[70dvh] w-[340px] overflow-y-auto p-2 rise">
          <p className="eyebrow px-2 py-1.5">Notifications</p>
          {items.length === 0 && <p className="px-2 py-6 text-center text-[13px] text-fg-3">You're all caught up.</p>}
          {items.map((n) => (
            <Popover.Item key={n.id} asChild>
              <Link href={n.href ?? "/"} className="block rounded-lg px-2 py-2 outline-none hover:bg-fill focus:bg-fill">
                <div className="flex items-center gap-2 text-[13px] font-medium">{!n.read && <span className="size-1.5 rounded-full bg-accent" />}{n.title}</div>
                {n.body && <div className="mt-0.5 line-clamp-2 text-[12px] text-fg-3">{n.body}</div>}
              </Link>
            </Popover.Item>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function b64ToBytes(b64: string) {
  const s = atob(b64.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

/** Enables Web Push on this device. On iPhone/iPad it only works from the Home Screen app. */
export function PushToggle({ devices }: { devices: number }) {
  const [msg, setMsg] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function enable() {
    setBusy(true); setMsg(undefined);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        throw new Error(/iPhone|iPad/.test(navigator.userAgent) ? "On iPhone/iPad, first Add Hearth to your Home Screen and open it from there." : "This browser doesn't support push notifications.");
      }
      if ((await Notification.requestPermission()) !== "granted") throw new Error("Notifications were not allowed. You can enable them in system settings.");
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await fetch("/api/push").then((r) => r.json());
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
      const r = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub) });
      if (!r.ok) throw new Error("Couldn't register this device.");
      setMsg("Notifications are on for this device.");
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={enable} disabled={busy} className="press inline-flex items-center gap-1.5 rounded-[10px] border border-line px-3.5 py-2 text-[13px] hover:bg-fill"><BellRing size={14} />{busy ? "Enabling…" : "Enable on this device"}</button>
      <span className="text-[12px] text-fg-3" role="status">{msg ?? (devices ? `${devices} device${devices > 1 ? "s" : ""} receiving notifications.` : "No devices registered yet.")}</span>
    </div>
  );
}
