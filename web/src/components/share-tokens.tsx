"use client";
import { TokenManager, type TokenRow } from "./tokens";

export function ShareLinks({ tokens }: { tokens: TokenRow[] }) {
  return <TokenManager kind="share" withDays tokens={tokens} placeholder="House-sitter (Pat)"
    render={(secret, origin) => ({ url: `${origin}/share/${secret}`, hint: "Send this to the sitter. It works only on your home network (or over Tailscale), shows only this card, and stops working when it expires or you revoke it." })} />;
}
