import { z } from "zod";
import { authenticateToken, bearer } from "@/server/tokens";
import { rateLimit } from "@/server/auth";
import { audit } from "@/server/audit";
import { publish } from "@/server/events";
import { parseCommand } from "@/lib/commands";
import { createItem, listItems, completeItem, parseInput } from "@/server/items/repo";
import { snapshot, briefingLines } from "@/server/briefing";
import { listRoutines, runRoutine } from "@/server/routines";
import { assistantTurn } from "@/server/assistant/turn";

const Body = z.object({ text: z.string().min(1).max(1000) });

/**
 * Siri / Shortcuts entry point. Authenticated by a per-device bearer key.
 * Returns plain text for Siri to speak. Deterministic commands run directly;
 * everything else goes to the assistant, whose sensitive actions are queued
 * for approval in the app (never executed from voice alone).
 */
export async function POST(req: Request) {
  const auth = authenticateToken(bearer(req), "shortcut");
  if (!auth) return new Response("Invalid or revoked key.", { status: 401 });
  if (!rateLimit(`shortcut:${auth.token.id}`, 60, 60_000)) return new Response("Slow down a moment.", { status: 429 });
  const b = Body.safeParse(await req.json().catch(() => null));
  if (!b.success) return new Response("Say something for Hearth to do.", { status: 400 });
  const user = auth.user;
  const cmd = parseCommand(b.data.text, listRoutines().map((r) => r.name));
  const say = (s: string, ok = true) => {
    audit({ actorId: user.id, actorKind: "user", action: `shortcut:${cmd.type}`, target: b.data.text.slice(0, 120), outcome: ok ? "ok" : "failed", detail: { device: auth.token.name } });
    return new Response(s, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  };

  switch (cmd.type) {
    case "add": {
      if (!cmd.items.length) return say("I didn't catch what to add.", false);
      for (const title of cmd.items) createItem(user.id, cmd.kind, parseInput(cmd.kind, { title }));
      publish(`items:${cmd.kind}`, user.id);
      const where = { grocery: "the grocery list", task: "your tasks", note: "notes" }[cmd.kind];
      return say(`Added ${cmd.items.join(", ").replace(/, ([^,]*)$/, " and $1")} to ${where}.`);
    }
    case "done": {
      const q = cmd.text.toLowerCase();
      const hit = listItems(user.id, { kind: ["task", "chore", "errand", "grocery"], status: "open" }).find((i) => i.title.toLowerCase().includes(q) || q.includes(i.title.toLowerCase()));
      if (!hit) return say(`I couldn't find an open item matching “${cmd.text}”.`, false);
      const r = completeItem(user.id, hit.id);
      publish(`items:${hit.kind}`, user.id);
      return say(`Marked “${hit.title}” done${r.rolledTo ? `. Next one is ${new Date(r.rolledTo).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}` : ""}.`);
    }
    case "briefing":
      return say(briefingLines(await snapshot(user.id), cmd.mode).join(" "));
    case "routine": {
      const r = listRoutines().find((x) => x.name === cmd.name)!;
      const msg = await runRoutine(r, user.id, "manual");
      return say(msg.startsWith("All") ? `${r.name} is done.` : msg);
    }
    case "ask": {
      let text = "";
      let pending = false;
      for await (const ev of assistantTurn(user, cmd.text, undefined, AbortSignal.timeout(90_000))) {
        if (ev.type === "token") text += ev.text as string;
        if (ev.type === "tool" && ev.status === "needs_confirmation") pending = true;
      }
      return say((text.trim() || "I don't have an answer for that.") + (pending ? " Open Hearth to approve." : ""));
    }
  }
}
