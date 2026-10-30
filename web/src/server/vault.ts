import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { db } from "./db/client";
import { env } from "./env";
import { newId } from "./ids";
import { decryptBuffer, decryptString, encryptBuffer, encryptString } from "./crypto";
import { log } from "./log";

/**
 * Private document vault. Files are AES-256-GCM encrypted at rest with a
 * vault-specific key; extracted text is encrypted separately. Search decrypts
 * in memory — fine for a household-scale corpus (thousands of docs).
 */
export type Doc = {
  id: string; owner_id: string; visibility: "shared" | "private"; name: string; folder: string; mime: string; size: number;
  sha256: string; text_status: "none" | "pending" | "done" | "failed" | "unsupported"; expires_at: number | null; tags: string[]; created_at: number;
};
type Row = Omit<Doc, "tags"> & { tags: string; text_enc: string | null };
const toDoc = ({ text_enc: _t, ...r }: Row): Doc => ({ ...r, tags: JSON.parse(r.tags) });

export const MAX_UPLOAD = 25 * 1024 * 1024;
const ALLOWED = /^(application\/pdf|image\/(png|jpeg|heic|webp)|text\/(plain|markdown|csv))$/;

const blobPath = (id: string) => path.join(env().vaultDir, `${id}.bin`);

export function listDocs(viewerId: string, opts: { folder?: string } = {}): Doc[] {
  return (db().prepare(`SELECT * FROM documents WHERE (visibility='shared' OR owner_id=@v) AND (@f IS NULL OR folder=@f) ORDER BY created_at DESC`)
    .all({ v: viewerId, f: opts.folder ?? null }) as Row[]).map(toDoc);
}

export function getDoc(viewerId: string, id: string): (Doc & { text: string | null }) | null {
  const r = db().prepare(`SELECT * FROM documents WHERE id=@id AND (visibility='shared' OR owner_id=@v)`).get({ id, v: viewerId }) as Row | undefined;
  if (!r) return null;
  return { ...toDoc(r), text: r.text_enc ? decryptString(r.text_enc, "vault-text") : null };
}

export async function storeDoc(ownerId: string, file: { name: string; type: string; bytes: Buffer }, meta: { folder?: string; visibility?: "shared" | "private"; expiresAt?: number | null; tags?: string[] }) {
  if (file.bytes.length > MAX_UPLOAD) throw new Error("File is larger than 25 MB");
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED.test(mime)) throw new Error("Unsupported file type. Upload PDF, image or text files.");
  fs.mkdirSync(env().vaultDir, { recursive: true, mode: 0o700 });
  const id = newId();
  fs.writeFileSync(blobPath(id), encryptBuffer(file.bytes, "vault"), { mode: 0o600 });
  const isText = mime.startsWith("text/");
  db().prepare(`INSERT INTO documents (id,owner_id,visibility,name,folder,mime,size,sha256,text_enc,text_status,expires_at,tags,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, ownerId, meta.visibility ?? "private", path.basename(file.name).slice(0, 200), (meta.folder || "General").slice(0, 60), mime, file.bytes.length,
      crypto.createHash("sha256").update(file.bytes).digest("hex"),
      isText ? encryptString(file.bytes.toString("utf8").slice(0, 500_000), "vault-text") : null,
      isText ? "done" : "pending", meta.expiresAt ?? null, JSON.stringify(meta.tags ?? []), Date.now());
  if (!isText) void extractText(id, mime, file.bytes);
  return id;
}

/** OCR / PDF text extraction is delegated to the Python brain service when available. */
async function extractText(id: string, mime: string, bytes: Buffer) {
  try {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(bytes)], { type: mime }), "upload");
    const r = await fetch(`${env().brainUrl}/extract`, { method: "POST", body: form, headers: { "X-Hearth-Token": env().serviceToken }, signal: AbortSignal.timeout(120_000) });
    if (r.status === 415) return setText(id, null, "unsupported");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const { text } = (await r.json()) as { text: string };
    setText(id, text, "done");
  } catch (e) {
    log.warn("vault.extract_failed", { id, error: String(e) });
    setText(id, null, "failed");
  }
}

function setText(id: string, text: string | null, status: Doc["text_status"]) {
  db().prepare("UPDATE documents SET text_enc=?, text_status=? WHERE id=?").run(text ? encryptString(text, "vault-text") : null, status, id);
}

export async function retryExtraction(viewerId: string, id: string) {
  const d = getDoc(viewerId, id);
  if (!d) throw new Error("Not found");
  setText(id, null, "pending");
  await extractText(id, d.mime, readDocBytes(viewerId, id)!.bytes);
}

export function readDocBytes(viewerId: string, id: string): { doc: Doc; bytes: Buffer } | null {
  const d = getDoc(viewerId, id);
  if (!d) return null;
  return { doc: d, bytes: decryptBuffer(fs.readFileSync(blobPath(id)), "vault") };
}

export function updateDoc(viewerId: string, id: string, patch: { name?: string; folder?: string; visibility?: "shared" | "private"; expiresAt?: number | null }) {
  const d = getDoc(viewerId, id);
  if (!d) throw new Error("Not found");
  const vis = d.owner_id === viewerId ? (patch.visibility ?? d.visibility) : d.visibility;
  db().prepare("UPDATE documents SET name=?, folder=?, visibility=?, expires_at=? WHERE id=?")
    .run(patch.name?.trim() || d.name, patch.folder?.trim() || d.folder, vis, patch.expiresAt === undefined ? d.expires_at : patch.expiresAt, id);
}

export function deleteDoc(viewerId: string, id: string) {
  const d = getDoc(viewerId, id);
  if (!d) throw new Error("Not found");
  if (d.owner_id !== viewerId && d.visibility === "private") throw new Error("Not allowed");
  db().prepare("DELETE FROM documents WHERE id=?").run(id);
  fs.rmSync(blobPath(id), { force: true });
  return d;
}

export type SearchHit = { doc: Doc; snippet: string; score: number };

export function searchDocs(viewerId: string, query: string, limit = 10): SearchHit[] {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1).slice(0, 8);
  if (!terms.length) return [];
  const rows = db().prepare(`SELECT * FROM documents WHERE visibility='shared' OR owner_id=?`).all(viewerId) as Row[];
  const hits: SearchHit[] = [];
  for (const r of rows) {
    const text = r.text_enc ? decryptString(r.text_enc, "vault-text") : "";
    const hay = `${r.name} ${r.folder} ${r.tags} ${text}`.toLowerCase();
    let score = 0;
    for (const t of terms) {
      const n = hay.split(t).length - 1;
      if (n) score += 1 + Math.log(n) + (r.name.toLowerCase().includes(t) ? 3 : 0);
    }
    if (!score) continue;
    const i = Math.max(0, text.toLowerCase().indexOf(terms[0]));
    hits.push({ doc: toDoc(r), score, snippet: text ? text.slice(Math.max(0, i - 80), i + 220).replace(/\s+/g, " ") : "" });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function folders(viewerId: string): string[] {
  return (db().prepare(`SELECT DISTINCT folder FROM documents WHERE visibility='shared' OR owner_id=? ORDER BY folder`).all(viewerId) as { folder: string }[]).map((r) => r.folder);
}
