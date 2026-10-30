/**
 * Deterministic understanding of common spoken commands, so Siri requests are
 * instant and work even when no AI model is running. Anything unmatched falls
 * through to the assistant.
 */
export type Command =
  | { type: "add"; kind: "grocery" | "task" | "note"; items: string[] }
  | { type: "done"; text: string }
  | { type: "briefing"; mode: "morning" | "evening" }
  | { type: "routine"; name: string }
  | { type: "ask"; text: string };

const LIST = /\s+(?:to|on(?:to)?)\s+(?:the\s+|my\s+|our\s+)?(grocery|groceries|shopping|to-?do|task|tasks)(?:\s+list)?\s*\.?$/i;

function splitItems(s: string): string[] {
  return s.split(/\s*(?:,|\band\b|\&)\s*/i).map((x) => x.replace(/^(?:some|a|an|the)\s+/i, "").trim()).filter((x) => x.length > 0 && x.length < 80).slice(0, 15).map((x) => x[0].toUpperCase() + x.slice(1));
}

export function parseCommand(input: string, routineNames: string[] = []): Command {
  const t = input.trim().replace(/^(hey\s+)?(hearth|siri|mabel|mable)[,\s]+/i, "").replace(/[.!?]+$/, "");
  const lower = t.toLowerCase();
  let m = /^(?:please\s+)?(?:add|put)\s+(.+)$/i.exec(t);
  if (m && LIST.test(m[1])) {
    const which = LIST.exec(m[1])![1].toLowerCase();
    return { type: "add", kind: /groc|shop/.test(which) ? "grocery" : "task", items: splitItems(m[1].replace(LIST, "")) };
  }
  if ((m = /^(?:we(?:'re| are)\s+(?:out of|low on)|we need)\s+(.+)$/i.exec(t))) return { type: "add", kind: "grocery", items: splitItems(m[1]) };
  if ((m = /^remind (?:me|us) to\s+(.+)$/i.exec(t))) return { type: "add", kind: "task", items: [m[1].trim()[0].toUpperCase() + m[1].trim().slice(1)] };
  if ((m = /^(?:make a |take a )?note(?: that)?[:\s]+(.+)$/i.exec(t))) return { type: "add", kind: "note", items: [m[1].trim()] };
  if ((m = /^(?:i |we )?(?:finished|did|done with|completed|took out|mark(?:ed)?)\s+(.+?)(?:\s+(?:as\s+)?done)?$/i.exec(t)) && !/\?$/.test(input)) return { type: "done", text: m[1].replace(/^the\s+/i, "") };
  if (/^(what'?s|whats|how'?s)\s+(my|our|the)\s+(day|morning|plan)|^(good morning|morning briefing|briefing)$/.test(lower)) return { type: "briefing", mode: "morning" };
  if (/^(evening recap|recap|what'?s (on )?(for )?tomorrow)/.test(lower)) return { type: "briefing", mode: "evening" };
  const r = routineNames.find((n) => lower === n.toLowerCase() || lower === `run ${n.toLowerCase()}` || lower === `start ${n.toLowerCase()}`);
  if (r) return { type: "routine", name: r };
  return { type: "ask", text: t };
}
