"use client";
import { Printer } from "lucide-react";

export function PrintButton() {
  return <button onClick={() => window.print()} className="press inline-flex items-center gap-1.5 rounded-[10px] bg-fg px-3 py-2 text-[13px] font-medium text-bg"><Printer size={14} />Print / PDF</button>;
}
