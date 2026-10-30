"use client";
import { useState, useTransition } from "react";
import { backupNow } from "@/server/settings-actions";
import { Button } from "./ui";
import { ElevateDialog } from "./elevate";

export function BackupButton() {
  const [msg, setMsg] = useState<string>();
  const [elev, setElev] = useState(false);
  const [pending, start] = useTransition();
  const go = () => start(async () => {
    const r = await backupNow();
    if (r.error === "elevate") setElev(true);
    else setMsg(r.message ?? r.error);
  });
  return (
    <div className="flex items-center gap-3">
      <Button variant="secondary" disabled={pending} onClick={go}>{pending ? "Backing up…" : "Back up now"}</Button>
      {msg && <span className="text-[13px] text-fg-2" role="status">{msg}</span>}
      <ElevateDialog open={elev} onOpenChange={setElev} reason="Creating a backup copies all household data." onDone={go} />
    </div>
  );
}
