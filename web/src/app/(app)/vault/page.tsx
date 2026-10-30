import { requireUser } from "@/server/auth";
import { listDocs, smartSearch, folders, type Doc } from "@/server/vault";
import { getSettings } from "@/server/settings";
import { todayIn, DAY } from "@/lib/time";
import { PageHeader, inputCls } from "@/components/ui";
import { VaultList, VaultUpload, type DocRow } from "@/components/vault";
import { Tabs } from "@/components/tabs";

const STATUS: Record<Doc["text_status"], string> = { none: "", done: "searchable", pending: "reading…", failed: "text extraction failed", unsupported: "not searchable" };

export default async function Vault({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const user = await requireUser();
  const { tab, q } = await searchParams;
  const today = todayIn(getSettings().timezone);
  const toRow = (d: Doc, snippet?: string): DocRow => ({
    id: d.id, name: d.name, folder: d.folder, sizeKb: Math.ceil(d.size / 1024), shared: d.visibility === "shared", mine: d.owner_id === user.id,
    added: new Date(d.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    expires: d.expires_at ? new Date(d.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : null,
    expiringSoon: !!d.expires_at && d.expires_at - today < 60 * DAY, text: STATUS[d.text_status], snippet,
  });
  const fs = folders(user.id);
  const rows = q ? (await smartSearch(user.id, q, 30)).map((h) => toRow(h.doc, h.snippet || undefined)) : listDocs(user.id, { folder: tab && tab !== "all" ? tab : undefined }).map((d) => toRow(d));
  return (
    <div className="mx-auto max-w-[980px] px-5 md:px-10 pt-10 md:pt-14 pb-12">
      <PageHeader title="Vault" subtitle="Encrypted documents. Private unless you share them."><VaultUpload /></PageHeader>
      <form className="rise mt-6"><input name="q" defaultValue={q} placeholder="Search by meaning — “dishwasher receipt”, “when does the policy renew”…" className={inputCls} /></form>
      {!q && <Tabs base="/vault" active={tab ?? "all"} tabs={[{ key: "all", label: "All" }, ...fs.map((f) => ({ key: f, label: f }))]} />}
      <div className="mt-6">{q && <p className="mb-3 text-[13px] text-fg-3">{rows.length} result{rows.length === 1 ? "" : "s"} for “{q}”</p>}<VaultList docs={rows} /></div>
    </div>
  );
}
