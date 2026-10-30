import { db } from "./db/client";
import { getSettings } from "./settings";
import { decryptString, encryptString } from "./crypto";
import { brain } from "./brain-proxy";
import { log } from "./log";

/**
 * Semantic index over vault text. Chunk text is stored encrypted; vectors
 * are stored as float32 blobs (they are not reversible to text in practice,
 * but live only inside the encrypted-at-rest data directory regardless).
 */
const EMBED_MODEL = process.env.HEARTH_EMBED_MODEL ?? "nomic-embed-text";

export function chunk(text: string, size = 900, overlap = 150): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  const out: string[] = [];
  for (let i = 0; i < clean.length && out.length < 200; i += size - overlap) out.push(clean.slice(i, i + size));
  return out;
}

async function embed(texts: string[], kind: "document" | "query"): Promise<number[][] | null> {
  const s = getSettings();
  try {
    const r = await brain("/embed", {
      method: "POST", headers: { "Content-Type": "application/json" }, timeoutMs: 120_000,
      // nomic-embed-text expects task prefixes for best retrieval quality.
      body: JSON.stringify({ model: EMBED_MODEL, texts: texts.map((t) => `${kind === "query" ? "search_query" : "search_document"}: ${t}`),
        models: { local: s.ai_endpoint, remote: s.ai_remote_endpoint || null, prefer_remote: s.ai_prefer_remote } }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()).embeddings as number[][];
  } catch (e) {
    log.debug("semantic.embed_unavailable", { error: String(e) });
    return null;
  }
}

const toBlob = (v: number[]) => Buffer.from(new Float32Array(v).buffer);
const fromBlob = (b: Buffer) => new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);

export async function indexDocument(docId: string, text: string): Promise<boolean> {
  const chunks = chunk(text);
  if (!chunks.length) return false;
  const vecs: number[][] = [];
  for (let i = 0; i < chunks.length; i += 32) {
    const v = await embed(chunks.slice(i, i + 32), "document");
    if (!v) return false;
    vecs.push(...v);
  }
  db().transaction(() => {
    db().prepare("DELETE FROM doc_chunks WHERE doc_id=?").run(docId);
    const ins = db().prepare("INSERT INTO doc_chunks (doc_id,idx,text_enc,embedding) VALUES (?,?,?,?)");
    chunks.forEach((c, i) => ins.run(docId, i, encryptString(c, "vault-text"), toBlob(vecs[i])));
  })();
  return true;
}

function cosine(a: Float32Array, b: Float32Array) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na * nb) || 1);
}

/** Best-matching chunks among documents the viewer may see; null if embeddings are unavailable. */
export async function semanticSearch(viewerId: string, query: string, limit = 8): Promise<{ docId: string; score: number; snippet: string }[] | null> {
  const has = db().prepare("SELECT 1 FROM doc_chunks LIMIT 1").get();
  if (!has) return null;
  const q = await embed([query], "query");
  if (!q) return null;
  const qv = new Float32Array(q[0]);
  const rows = db().prepare(`SELECT c.doc_id, c.text_enc, c.embedding FROM doc_chunks c JOIN documents d ON d.id = c.doc_id
    WHERE d.visibility='shared' OR d.owner_id=?`).all(viewerId) as { doc_id: string; text_enc: string; embedding: Buffer }[];
  const best = new Map<string, { score: number; enc: string }>();
  for (const r of rows) {
    const s = cosine(qv, fromBlob(r.embedding));
    if (s > (best.get(r.doc_id)?.score ?? -1)) best.set(r.doc_id, { score: s, enc: r.text_enc });
  }
  return [...best.entries()].filter(([, v]) => v.score > 0.45).sort((a, b) => b[1].score - a[1].score).slice(0, limit)
    .map(([docId, v]) => ({ docId, score: v.score, snippet: decryptString(v.enc, "vault-text").slice(0, 300) }));
}
