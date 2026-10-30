import { EventEmitter } from "node:events";

/**
 * In-process change bus powering realtime collaboration. Server actions emit a
 * topic after commits; /api/events streams it over SSE to every open client.
 * Single-node by design (one Pi) — swap for Postgres LISTEN/NOTIFY if scaled.
 */
export type ChangeEvent = { topic: string; actorId?: string; at: number };

declare global {
  // eslint-disable-next-line no-var
  var __hearthBus: EventEmitter | undefined;
}

export function bus(): EventEmitter {
  if (!globalThis.__hearthBus) {
    globalThis.__hearthBus = new EventEmitter();
    globalThis.__hearthBus.setMaxListeners(100);
  }
  return globalThis.__hearthBus;
}

export function publish(topic: string, actorId?: string) {
  bus().emit("change", { topic, actorId, at: Date.now() } satisfies ChangeEvent);
}
