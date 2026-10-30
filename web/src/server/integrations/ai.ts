import { env } from "../env";
import { getSettings } from "../settings";

/** Health of the AI layer: the Python "brain" service and the model servers behind it. */
export type AIStatus = {
  brain: { ok: boolean; message: string };
  endpoints: { url: string; role: "local" | "remote"; ok: boolean; models: string[]; message: string }[];
  activeModel: string;
};

async function probeOllama(url: string) {
  try {
    const r = await fetch(`${url.replace(/\/$/, "")}/api/tags`, { signal: AbortSignal.timeout(2500), cache: "no-store" });
    if (!r.ok) return { ok: false, models: [], message: `HTTP ${r.status}` };
    const j = (await r.json()) as { models?: { name: string }[] };
    return { ok: true, models: (j.models ?? []).map((m) => m.name), message: "Online" };
  } catch {
    return { ok: false, models: [], message: "Not reachable" };
  }
}

export async function aiStatus(): Promise<AIStatus> {
  const s = getSettings();
  const brain = await fetch(`${env().brainUrl}/health`, { signal: AbortSignal.timeout(2500), cache: "no-store" })
    .then((r) => ({ ok: r.ok, message: r.ok ? "Online" : `HTTP ${r.status}` }))
    .catch(() => ({ ok: false, message: "Not running" }));
  const endpoints: AIStatus["endpoints"] = [{ url: s.ai_endpoint, role: "local", ...(await probeOllama(s.ai_endpoint)) }];
  if (s.ai_remote_endpoint) endpoints.push({ url: s.ai_remote_endpoint, role: "remote", ...(await probeOllama(s.ai_remote_endpoint)) });
  return { brain, endpoints, activeModel: s.ai_model };
}
