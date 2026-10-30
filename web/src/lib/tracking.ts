/**
 * Carrier detection and tracking links from tracking-number formats, plus
 * extraction from pasted shipping emails. Pure pattern matching: email text is
 * untrusted, so it is never interpreted as instructions.
 */
export type Carrier = "UPS" | "USPS" | "FedEx" | "DHL" | "Amazon";

const PATTERNS: [Carrier, RegExp][] = [
  ["UPS", /\b1Z[0-9A-Z]{16}\b/g],
  ["Amazon", /\bTBA\d{12}\b/g],
  ["USPS", /\b(?:94|93|92|95|82)\d{20}\b|\b(?:EA|EC|CP|RA|LZ)\d{9}US\b/g],
  ["FedEx", /\b\d{12}\b|\b\d{15}\b/g],
  ["DHL", /\b\d{10}\b|\bJJD\d{18}\b/g],
];

export function detectCarrier(tracking: string): Carrier | null {
  const t = tracking.replace(/\s+/g, "").toUpperCase();
  for (const [c, re] of PATTERNS) if (new RegExp(`^(?:${re.source})$`.replace(/\\b/g, "")).test(t)) return c;
  return null;
}

export function trackingUrl(carrier: string | undefined, tracking: string | undefined): string | null {
  if (!tracking) return null;
  const t = encodeURIComponent(tracking.replace(/\s+/g, ""));
  switch (carrier ?? detectCarrier(tracking)) {
    case "UPS": return `https://www.ups.com/track?tracknum=${t}`;
    case "USPS": return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
    case "FedEx": return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
    case "DHL": return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?tracking-id=${t}`;
    case "Amazon": return "https://www.amazon.com/gp/your-account/order-history";
    default: return null;
  }
}

export type Extracted = { carrier: Carrier; tracking: string; merchant?: string; title?: string; expected?: string };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function extractFromEmail(text: string, now = new Date()): Extracted[] {
  const body = text.slice(0, 50_000);
  const seen = new Set<string>();
  const out: Extracted[] = [];
  // Order matters: specific formats first so a UPS number isn't also read as FedEx digits.
  for (const [carrier, re] of PATTERNS) {
    for (const m of body.matchAll(re)) {
      const t = m[0].toUpperCase();
      if ([...seen].some((s) => s.includes(t) || t.includes(s))) continue;
      // Bare digit runs are ambiguous (order numbers, phone numbers): require a nearby carrier/tracking word.
      if (/^\d+$/.test(t)) {
        const ctx = body.slice(Math.max(0, m.index! - 80), m.index! + t.length + 20).toLowerCase();
        if (!ctx.includes(carrier.toLowerCase()) && !/tracking|track/.test(ctx)) continue;
      }
      seen.add(t);
      out.push({ carrier, tracking: t });
    }
  }
  const merchant = /^from:\s*(?:"?([^"<\n]+?)"?\s*<)?/im.exec(body)?.[1]?.trim() ?? /\byour ([A-Z][\w&' ]{1,30}) order\b/.exec(body)?.[1];
  const title = /(?:^subject:\s*)(.+)$/im.exec(body)?.[1]?.replace(/^(re|fwd?):\s*/i, "").trim().slice(0, 80);
  const dm = /(?:arriv\w*|deliver\w*|expected)[^.\n]{0,40}?\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\.?\s+(\d{1,2})\b/i.exec(body);
  let expected: string | undefined;
  if (dm) {
    const mon = MONTHS.indexOf(dm[1].toLowerCase().slice(0, 3));
    let yr = now.getUTCFullYear();
    if (mon < now.getUTCMonth() - 6) yr++;
    expected = `${yr}-${String(mon + 1).padStart(2, "0")}-${String(+dm[2]).padStart(2, "0")}`;
  }
  return out.slice(0, 5).map((o) => ({ ...o, merchant, title, expected }));
}
