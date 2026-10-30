/** Grocery helpers: ingredient parsing, store-section guessing and purchase-rhythm learning. */
const UNITS = "cups?|c\\.|tbsps?|tablespoons?|tsps?|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|l|liters?|cloves?|cans?|packages?|pkgs?|bunch(?:es)?|heads?|slices?|pinch(?:es)?|dash(?:es)?|sticks?|large|medium|small";
const QTY = new RegExp(`^\\s*((?:[\\d½¼¾⅓⅔⅛]+(?:[\\s/.-][\\d½¼¾⅓⅔⅛]+)*)\\s*(?:(?:${UNITS})\\b\\.?)?)\\s*(?:of\\s+)?`, "i");

export function parseIngredient(line: string): { name: string; quantity: string } | null {
  // Strip list markers ("-", "•", "1.", "2)") but keep leading quantities ("1 ½ lb").
  let s = line.replace(/^\s*(?:[-•*]+|\d+[.)])\s+/, "").trim();
  if (!s || /^(for the|to serve|optional|garnish)\b/i.test(s)) return null;
  const m = QTY.exec(s);
  const quantity = m ? m[1].trim() : "";
  s = s.slice(m ? m[0].length : 0);
  const name = s.replace(/\(.*?\)/g, "").split(/,|\bto taste\b|\bfor serving\b/i)[0].trim().replace(/\s+/g, " ");
  if (!name || name.length > 60) return null;
  return { name: name[0].toUpperCase() + name.slice(1), quantity };
}

const AISLES: [string, RegExp][] = [
  ["Produce", /apple|banana|berr|lemon|lime|orange|grape|avocado|tomato|potato|onion|garlic|ginger|lettuce|spinach|kale|carrot|celery|pepper|cucumber|zucchini|broccoli|cauliflower|mushroom|herb|cilantro|parsley|basil|scallion|fruit|vegetable|salad/i],
  ["Dairy", /milk|cheese|yogurt|butter|cream|egg|kefir|sour cream/i],
  ["Meat & Fish", /chicken|beef|pork|turkey|bacon|sausage|salmon|fish|shrimp|tuna|lamb|steak|ground/i],
  ["Bakery", /bread|bagel|bun|roll|tortilla|croissant|muffin|sourdough|baguette|pita/i],
  ["Frozen", /frozen|ice cream/i],
  ["Household", /soap|detergent|paper towel|toilet|tissue|trash bag|foil|wrap|sponge|cleaner|dishwasher|bleach|battery|light bulb/i],
  ["Pantry", /rice|pasta|flour|sugar|salt|oil|vinegar|sauce|bean|lentil|oat|cereal|coffee|tea|spice|stock|broth|honey|nut|peanut|jam|can|soup|cracker|chip|snack/i],
];
export function guessAisle(name: string): string { return AISLES.find(([, re]) => re.test(name))?.[0] ?? "Other"; }

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "").replace(/\b(organic|fresh|large|small)\b/g, "").replace(/s\b/g, "").replace(/\s+/g, " ").trim();

/**
 * Learns purchase rhythm from completed grocery items. Suggests items whose
 * typical interval has elapsed and that aren't already on the list.
 */
export function regulars(done: { title: string; completedAt: number }[], openTitles: string[], now: number) {
  const by = new Map<string, { title: string; times: number[] }>();
  for (const d of done) {
    const k = norm(d.title);
    const e = by.get(k) ?? { title: d.title, times: [] };
    e.times.push(d.completedAt);
    by.set(k, e);
  }
  const open = new Set(openTitles.map(norm));
  const out: { title: string; everyDays: number; lastDaysAgo: number }[] = [];
  for (const [k, e] of by) {
    if (open.has(k) || e.times.length < 3) continue;
    const t = e.times.sort((a, b) => a - b);
    const gaps = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b);
    const median = gaps[Math.floor(gaps.length / 2)];
    const since = now - t[t.length - 1];
    if (median < 86_400_000 || since < median * 0.85) continue;
    out.push({ title: e.title, everyDays: Math.round(median / 86_400_000), lastDaysAgo: Math.round(since / 86_400_000) });
  }
  return out.sort((a, b) => b.lastDaysAgo / b.everyDays - a.lastDaysAgo / a.everyDays).slice(0, 8);
}
