import { env } from "./env";

/** Forwards an authenticated request to the local brain service with the service token. */
export async function brain(path: string, init: RequestInit & { timeoutMs?: number } = {}) {
  return fetch(`${env().brainUrl}${path}`, {
    ...init, headers: { ...(init.headers ?? {}), "X-Hearth-Token": env().serviceToken },
    signal: AbortSignal.timeout(init.timeoutMs ?? 60_000), cache: "no-store",
  });
}
