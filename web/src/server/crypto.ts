import crypto from "node:crypto";
import { env } from "./env";

/**
 * Envelope format: v1.<iv b64url>.<tag b64url>.<ciphertext b64url>
 * AES-256-GCM with a per-purpose key derived from the master key via HKDF, so
 * a key used for vault files can never decrypt a stored integration token.
 */
type Purpose = "secrets" | "vault" | "vault-text";

const keyCache = new Map<Purpose, Buffer>();

function key(purpose: Purpose): Buffer {
  let k = keyCache.get(purpose);
  if (!k) {
    k = Buffer.from(crypto.hkdfSync("sha256", env().masterKey, Buffer.alloc(0), `hearth:${purpose}`, 32));
    keyCache.set(purpose, k);
  }
  return k;
}

export function encryptBuffer(plain: Buffer, purpose: Purpose): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(purpose), iv);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  // layout: 1 byte version | 12 iv | 16 tag | body
  return Buffer.concat([Buffer.from([1]), iv, cipher.getAuthTag(), body]);
}

export function decryptBuffer(blob: Buffer, purpose: Purpose): Buffer {
  if (blob[0] !== 1) throw new Error("Unsupported ciphertext version");
  const iv = blob.subarray(1, 13);
  const tag = blob.subarray(13, 29);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(purpose), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(blob.subarray(29)), decipher.final()]);
}

export function encryptString(plain: string, purpose: Purpose = "secrets"): string {
  return encryptBuffer(Buffer.from(plain, "utf8"), purpose).toString("base64url");
}

export function decryptString(blob: string, purpose: Purpose = "secrets"): string {
  return decryptBuffer(Buffer.from(blob, "base64url"), purpose).toString("utf8");
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
