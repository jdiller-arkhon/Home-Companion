import crypto from "node:crypto";

/** Time-sortable, URL-safe id (48-bit ms timestamp + 80 random bits). */
export function newId(): string {
  const ts = Date.now().toString(36).padStart(9, "0");
  return ts + crypto.randomBytes(10).toString("base64url").replace(/[-_]/g, "x");
}
