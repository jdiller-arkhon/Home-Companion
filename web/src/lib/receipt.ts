/**
 * Pattern-based extraction from receipt / appliance-label OCR text. Used
 * directly when no model is running, and to sanity-check model output.
 */
export type Capture = { product?: string; brand?: string; model?: string; serial?: string; store?: string; purchase_date?: string; warranty_months?: number };

const BRANDS = "Bosch|Samsung|LG|Whirlpool|GE|Frigidaire|KitchenAid|Maytag|Miele|Electrolux|Dyson|Sony|Panasonic|Breville|Cuisinart|Ninja|Vitamix|Rheem|Carrier|Trane|Lennox|Honeywell|Nest|Ecobee|Apple|Dell|HP|Lenovo|Roomba|iRobot|Shark|Kenmore|Haier|Toshiba|Philips|Weber|Traeger|Toro|DeWalt|Makita|Milwaukee";
const STORES = "Home Depot|Lowe'?s|Best Buy|Costco|Target|Walmart|Amazon|Apple Store|Sam'?s Club|IKEA|Williams[- ]Sonoma|Crate ?& ?Barrel|Ace Hardware|Sears|Abt|AJ Madison|Micro Center";

export function extractCapture(text: string, now = new Date()): Capture {
  const t = text.replace(/\r/g, "");
  const c: Capture = {};
  c.brand = new RegExp(`\\b(${BRANDS})\\b`, "i").exec(t)?.[1];
  c.store = new RegExp(`\\b(${STORES})\\b`, "i").exec(t)?.[1];
  c.model = /\b(?:model|mod(?:el)?\.?\s*no\.?|m\/n)\s*[:#]?\s*([A-Z0-9][A-Z0-9\-/.]{3,24})/i.exec(t)?.[1];
  c.serial = /\b(?:serial|ser\.?\s*no\.?|s\/n|sn)\s*[:#]?\s*([A-Z0-9][A-Z0-9\-]{4,24})/i.exec(t)?.[1];
  const w = /(\d{1,2})\s*[- ]?\s*(year|yr|month|mo)s?\b[^.\n]{0,20}warrant/i.exec(t) ?? /warrant[^.\n]{0,30}?(\d{1,2})\s*[- ]?\s*(year|yr|month|mo)s?/i.exec(t);
  if (w) c.warranty_months = +w[1] * (/^y/i.test(w[2]) ? 12 : 1);
  const d = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/.exec(t) ?? null;
  if (d) {
    const y = +d[3] < 100 ? 2000 + +d[3] : +d[3];
    const iso = `${y}-${String(+d[1]).padStart(2, "0")}-${String(+d[2]).padStart(2, "0")}`;
    if (+d[1] <= 12 && +d[2] <= 31 && Date.parse(iso) <= now.getTime() + 86_400_000) c.purchase_date = iso;
  } else {
    const iso = /\b(20\d{2})-(\d{2})-(\d{2})\b/.exec(t);
    if (iso) c.purchase_date = iso[0];
  }
  if (c.brand) {
    const line = t.split("\n").find((l) => l.toLowerCase().includes(c.brand!.toLowerCase()) && l.length < 80);
    c.product = line?.replace(/\s{2,}.*$/, "").replace(/\$?\d+[.,]\d{2}.*$/, "").trim() || undefined;
  }
  return Object.fromEntries(Object.entries(c).filter(([, v]) => v != null && v !== "")) as Capture;
}

export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
}
