import crypto from "node:crypto";
import { db } from "./db/client";
import { createItem, listItems, updateItem } from "./items/repo";
import { CATEGORIES } from "./items/kinds";

/**
 * Imports statement downloads (OFX/QFX "Quicken" or CSV) from online banking.
 * Read-only by construction: files contain history, never credentials, and
 * nothing here can initiate a transaction. Re-importing is safe (deduplicated).
 */
export type Txn = { date: number; amountCents: number; description: string; id: string };
export type Statement = { account?: { name: string; last4?: string; balanceCents?: number; asOf?: number }; txns: Txn[] };

function ofxDate(s: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(s.trim());
  if (!m) throw new Error(`Bad date ${s}`);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}
const tag = (block: string, name: string) => new RegExp(`<${name}>([^<\\r\\n]+)`, "i").exec(block)?.[1]?.trim();
const cents = (s: string) => Math.round(parseFloat(s.replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1")) * 100);
const hash = (...p: (string | number)[]) => crypto.createHash("sha1").update(p.join("|")).digest("hex").slice(0, 16);

export function parseOfx(text: string): Statement {
  const txns: Txn[] = [];
  for (const m of text.matchAll(/<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi)) {
    const b = m[1];
    const amt = tag(b, "TRNAMT"), dt = tag(b, "DTPOSTED");
    if (!amt || !dt) continue;
    const description = [tag(b, "NAME"), tag(b, "MEMO")].filter(Boolean).join(" — ").replace(/&amp;/g, "&").slice(0, 200) || "Transaction";
    const date = ofxDate(dt);
    txns.push({ date, amountCents: cents(amt), description, id: tag(b, "FITID") ?? hash(date, amt, description) });
  }
  const acct = tag(text, "ACCTID");
  const bal = /<LEDGERBAL>([\s\S]*?)(?:<\/LEDGERBAL>|<AVAILBAL>|$)/i.exec(text)?.[1];
  const org = tag(text, "ORG");
  const type = tag(text, "ACCTTYPE");
  return {
    account: acct ? { name: `${org ?? "Bank"} ${type ? type[0] + type.slice(1).toLowerCase() : "Account"}`, last4: acct.slice(-4),
      balanceCents: bal && tag(bal, "BALAMT") ? cents(tag(bal, "BALAMT")!) : undefined, asOf: bal && tag(bal, "DTASOF") ? ofxDate(tag(bal, "DTASOF")!) : undefined } : undefined,
    txns,
  };
}

function splitCsv(line: string): string[] {
  const out: string[] = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function csvDate(s: string): number {
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s);
  if (m) return Date.UTC(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[1] - 1, +m[2]);
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  throw new Error(`Unrecognised date "${s}"`);
}

export function parseCsv(text: string): Statement {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const hi = lines.findIndex((l) => /date/i.test(l) && /(amount|debit|withdrawal)/i.test(l));
  if (hi < 0) throw new Error("Couldn't find a header row with Date and Amount (or Debit/Credit) columns.");
  const h = splitCsv(lines[hi]).map((x) => x.toLowerCase());
  const col = (...names: string[]) => h.findIndex((x) => names.some((n) => x.includes(n)));
  const iDate = col("posted date", "posting date", "date"), iDesc = col("description", "payee", "memo", "name"), iAmt = col("amount");
  const iDebit = col("debit", "withdrawal"), iCredit = col("credit", "deposit");
  const txns: Txn[] = [];
  for (const line of lines.slice(hi + 1)) {
    const r = splitCsv(line);
    if (!r[iDate]) continue;
    let amountCents: number;
    if (iAmt >= 0 && r[iAmt]) amountCents = cents(r[iAmt]);
    else amountCents = (r[iCredit] ? cents(r[iCredit]) : 0) - (r[iDebit] ? Math.abs(cents(r[iDebit])) : 0);
    if (isNaN(amountCents)) continue;
    const date = csvDate(r[iDate]);
    const description = (r[iDesc] ?? "Transaction").slice(0, 200);
    txns.push({ date, amountCents, description, id: hash(date, amountCents, description) });
  }
  return { txns };
}

const RULES: [RegExp, (typeof CATEGORIES)[number]][] = [
  [/rent|mortgage|hoa|property/i, "Housing"], [/electric|edison|water|gas co|sdg&e|pg&e|internet|comcast|spectrum|verizon|at&t|t-mobile|utility/i, "Utilities"],
  [/grocery|safeway|kroger|trader joe|whole foods|ralphs|vons|costco|aldi|sprouts|albertsons/i, "Groceries"],
  [/restaurant|cafe|coffee|starbucks|doordash|uber eats|grubhub|pizza|taco|chipotle|mcdonald/i, "Dining"],
  [/shell|chevron|exxon|arco|fuel|gas station|uber|lyft|parking|toll|dmv/i, "Transport"], [/pharmacy|cvs|walgreens|medical|dental|kaiser|clinic|hospital/i, "Health"],
  [/insurance|geico|state farm|allstate|progressive/i, "Insurance"], [/netflix|spotify|hulu|disney|hbo|youtube|apple\.com|steam|movie|theater/i, "Entertainment"],
  [/amazon|target|walmart|best buy|ikea|home depot|lowe/i, "Shopping"], [/airline|hotel|airbnb|delta|united|southwest|marriott|expedia/i, "Travel"],
];
export function categorize(desc: string) { return RULES.find(([re]) => re.test(desc))?.[1] ?? "Other"; }

/** Imports outflows as expenses (inflows are counted but not stored as spending). */
export function importStatement(userId: string, st: Statement, opts: { visibility: "shared" | "private"; accountName?: string }) {
  const known = new Set(listItems(userId, { kind: "expense", limit: 100_000 }).map((e) => e.data.import_id).filter(Boolean) as string[]);
  let added = 0, skipped = 0, income = 0;
  db().transaction(() => {
    for (const t of st.txns) {
      if (t.amountCents >= 0) { income++; continue; }
      if (known.has(t.id)) { skipped++; continue; }
      createItem(userId, "expense", { title: t.description.replace(/\s{2,}/g, " "), due_at: t.date, amount_cents: Math.abs(t.amountCents),
        data: { category: categorize(t.description), import_id: t.id, notes: `Imported${opts.accountName ? ` from ${opts.accountName}` : ""}` } }, { visibility: opts.visibility });
      known.add(t.id); added++;
    }
    const a = st.account;
    if (a && a.balanceCents != null) {
      const name = opts.accountName || a.name;
      const existing = listItems(userId, { kind: "account" }).find((x) => x.data.last4 === a.last4 || x.title === name);
      const input = { title: existing?.title ?? name, amount_cents: a.balanceCents, due_at: a.asOf ?? Date.now(), data: { last4: a.last4 ?? "", institution: existing?.data.institution ?? "" } };
      if (existing) updateItem(userId, existing.id, input); else createItem(userId, "account", input, { visibility: opts.visibility });
    }
  })();
  return { added, skipped, income, balanceUpdated: st.account?.balanceCents != null };
}
