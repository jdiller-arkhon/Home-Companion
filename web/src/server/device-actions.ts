"use server";
import { revalidatePath } from "next/cache";
import { requireUser, isElevated } from "./auth";
import { audit } from "./audit";
import { publish } from "./events";
import { callService, getDevice } from "./integrations/homeassistant";

export type DeviceCommand = { entityId: string; action: "toggle" | "turn_on" | "turn_off" | "lock" | "unlock" | "open" | "close" | "set_temperature" | "brightness" | "activate"; value?: number };

/** Same policy as the assistant: security-sensitive commands need step-up auth. */
function needsElevation(domain: string, action: string, deviceClass?: string) {
  if (domain === "lock" && action === "unlock") return true;
  if (domain === "alarm_control_panel") return true;
  if (domain === "cover" && ["garage", "gate", "door"].includes(deviceClass ?? "") && action === "open") return true;
  return false;
}

export async function controlDevice(cmd: DeviceCommand): Promise<{ ok?: boolean; error?: string; needsElevation?: boolean }> {
  const user = await requireUser();
  const dev = await getDevice(cmd.entityId).catch(() => null);
  if (!dev) return { error: "Device not found or Home Assistant unreachable." };
  if (needsElevation(dev.domain, cmd.action, dev.deviceClass) && !(await isElevated())) return { needsElevation: true };
  const d = dev.domain;
  try {
    switch (cmd.action) {
      case "toggle": await callService(d, "toggle", { entity_id: dev.id }); break;
      case "turn_on": case "turn_off": await callService(d, cmd.action, { entity_id: dev.id }); break;
      case "activate": await callService(d, "turn_on", { entity_id: dev.id }); break;
      case "brightness": await callService("light", "turn_on", { entity_id: dev.id, brightness_pct: Math.max(1, Math.min(100, cmd.value ?? 100)) }); break;
      case "lock": case "unlock": if (d !== "lock") throw new Error("Not a lock"); await callService("lock", cmd.action, { entity_id: dev.id }); break;
      case "open": case "close": if (d !== "cover") throw new Error("Not a cover"); await callService("cover", `${cmd.action}_cover`, { entity_id: dev.id }); break;
      case "set_temperature": if (d !== "climate" || cmd.value == null || cmd.value < 40 || cmd.value > 95) throw new Error("Invalid temperature"); await callService("climate", "set_temperature", { entity_id: dev.id, temperature: cmd.value }); break;
    }
  } catch (e) {
    audit({ actorId: user.id, actorKind: "user", action: `device:${cmd.action}`, target: dev.name, outcome: "failed", detail: { error: String(e) } });
    return { error: e instanceof Error ? e.message : String(e) };
  }
  audit({ actorId: user.id, actorKind: "user", action: `device:${cmd.action}`, target: dev.name, outcome: "ok", detail: { entity: dev.id, value: cmd.value } });
  publish("home", user.id);
  revalidatePath("/devices");
  return { ok: true };
}
