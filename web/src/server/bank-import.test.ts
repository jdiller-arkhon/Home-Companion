import { beforeEach, describe, expect, it } from "vitest";
import { openDatabase, useDatabaseForTests, db } from "./db/client";
import { parseOfx, parseCsv, importStatement, categorize } from "./bank-import";
import { listItems } from "./items/repo";

const OFX = `OFXHEADER:100
<OFX><SIGNONMSGSRSV1><SONRS><FI><ORG>Wescom</ORG></FI></SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><ACCTID>0012345678<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261028120000<TRNAMT>-54.21<FITID>A1<NAME>TRADER JOE'S #123</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261029<TRNAMT>2500.00<FITID>A2<NAME>PAYROLL</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261029<TRNAMT>-15.49<FITID>A3<NAME>NETFLIX.COM</STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>4210.55<DTASOF>20261030</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

beforeEach(() => {
  useDatabaseForTests(openDatabase(":memory:"));
  db().prepare("INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES ('a','Alex','a@h','x','admin',1)").run();
});

describe("bank import", () => {
  it("parses OFX (SGML, unclosed tags) with balance and masks the account", () => {
    const st = parseOfx(OFX);
    expect(st.txns).toHaveLength(3);
    expect(st.account).toMatchObject({ last4: "5678", balanceCents: 421055, asOf: Date.UTC(2026, 9, 30) });
  });

  it("imports spending once, skips income, records the balance", () => {
    const r1 = importStatement("a", parseOfx(OFX), { visibility: "shared" });
    expect(r1).toMatchObject({ added: 2, skipped: 0, income: 1, balanceUpdated: true });
    expect(importStatement("a", parseOfx(OFX), { visibility: "shared" })).toMatchObject({ added: 0, skipped: 2 });
    const ex = listItems("a", { kind: "expense" });
    expect(ex.map((e) => e.data.category).sort()).toEqual(["Entertainment", "Groceries"]);
    const acct = listItems("a", { kind: "account" });
    expect(acct).toHaveLength(1);
    expect(acct[0].amount_cents).toBe(421055);
    expect(JSON.stringify(acct[0])).not.toContain("0012345678");
  });

  it("parses CSV with debit/credit columns and quoted commas", () => {
    const st = parseCsv(`Account,Wescom\nPosted Date,Description,Debit,Credit\n10/28/2026,"SHELL OIL, #4",42.10,\n10/29/2026,DEPOSIT,,100.00\n`);
    expect(st.txns).toEqual([
      expect.objectContaining({ date: Date.UTC(2026, 9, 28), amountCents: -4210, description: "SHELL OIL, #4" }),
      expect.objectContaining({ amountCents: 10000 }),
    ]);
    expect(categorize("SHELL OIL, #4")).toBe("Transport");
  });
});
