"use server";
import { requireUser } from "./auth";
import { audit } from "./audit";
import { storeDoc, getDoc } from "./vault";
import { brain } from "./brain-proxy";
import { getSettings } from "./settings";
import { extractCapture, addMonths, type Capture } from "@/lib/receipt";

export type CaptureResult = { error?: string; docName?: string; fields?: Record<string, string>; note?: string };

/**
 * Photo of a receipt or appliance label → encrypted in the Vault → OCR →
 * fields (local model when available, patterns otherwise) → pre-filled
 * appliance form. Nothing is saved as a record until the person confirms.
 */
export async function captureFromPhoto(f: FormData): Promise<CaptureResult> {
  const user = await requireUser();
  const file = f.get("photo");
  if (!(file instanceof File) || !file.size) return { error: "Take or choose a photo first." };
  const name = `Receipt ${new Date().toISOString().slice(0, 10)}.${file.type.split("/")[1] ?? "jpg"}`;
  let id: string;
  try {
    id = await storeDoc(user.id, { name, type: file.type, bytes: Buffer.from(await file.arrayBuffer()) }, { folder: "Receipts & Manuals", visibility: "shared", awaitText: true });
  } catch (e) { return { error: (e as Error).message }; }
  audit({ actorId: user.id, actorKind: "user", action: "capture:photo", target: name, outcome: "ok" });

  const text = getDoc(user.id, id)?.text ?? "";
  if (!text) return { docName: name, fields: { notes: `Receipt/label photo in Vault → Receipts & Manuals → ${name}.` }, note: "Saved to the Vault, but the text couldn't be read (is the AI service running?). Fill in the details below." };

  let c: Capture = extractCapture(text);
  const s = getSettings();
  try {
    const r = await brain("/structure", { method: "POST", headers: { "Content-Type": "application/json" }, timeoutMs: 90_000,
      body: JSON.stringify({ text, models: { local: s.ai_endpoint, remote: s.ai_remote_endpoint || null, prefer_remote: s.ai_prefer_remote, model: s.ai_model } }) });
    if (r.ok) {
      const m = (await r.json()).fields as Capture;
      // Model fills gaps; validated pattern matches win where both exist.
      const clean = Object.fromEntries(Object.entries(m ?? {}).filter(([k, v]) => v != null && v !== "" && (k !== "purchase_date" || /^\d{4}-\d{2}-\d{2}$/.test(String(v)))));
      c = { ...clean, ...c };
    }
  } catch { /* patterns only */ }

  const fields: Record<string, string> = {};
  if (c.product || c.brand) fields.title = (c.product ?? `${c.brand} appliance`).replace(/\b(\w)(\w*)/g, (_, a, b) => a + b.toLowerCase());
  if (c.brand) fields.brand = c.brand[0] + c.brand.slice(1).toLowerCase();
  if (c.model) fields.model = c.model;
  if (c.serial) fields.serial = c.serial;
  if (c.purchase_date) fields.purchased = c.purchase_date;
  if (c.purchase_date && c.warranty_months) fields.due_at = addMonths(c.purchase_date, Math.min(c.warranty_months, 240));
  fields.notes = `Receipt/label photo in Vault → Receipts & Manuals → ${name}${c.store ? `. Bought at ${c.store}` : ""}.`;
  return { docName: name, fields, note: Object.keys(fields).length > 1 ? "Check the details, then save." : "Saved to the Vault. Couldn't find product details — fill them in below." };
}
