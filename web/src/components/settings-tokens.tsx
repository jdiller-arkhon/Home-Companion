"use client";
import { TokenManager, type TokenRow } from "./tokens";

export function CalendarLink({ tokens }: { tokens: TokenRow[] }) {
  return <TokenManager kind="calendar" tokens={tokens} placeholder="My iPhone"
    render={(secret, origin) => {
      const url = `${origin}/api/calendar/${secret}.ics`;
      return { url, primary: { href: url.replace(/^https?:/, "webcal:"), label: "Add to iPhone Calendar" },
        hint: "Tap the button on your iPhone or iPad. Your private items appear only on your own calendar. Updates arrive about every 30 minutes." };
    }} />;
}

export function ShortcutTokens({ tokens }: { tokens: TokenRow[] }) {
  return <TokenManager kind="shortcut" tokens={tokens} placeholder="Jordan's iPhone"
    render={(secret, origin) => ({ url: secret, primary: { href: `${origin}/shortcuts`, label: "Set up Shortcuts" },
      hint: `Server: ${origin} — paste this key into each Hearth shortcut. It can add items, read your briefing, run routines and ask the assistant; anything sensitive still waits for approval in the app.` })} />;
}
