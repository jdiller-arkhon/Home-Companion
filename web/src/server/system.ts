import fs from "node:fs";
import os from "node:os";
import { env } from "./env";
import { db } from "./db/client";
import { log } from "./log";
import { aiStatus } from "./integrations/ai";
import { ping as haPing, haConfigured } from "./integrations/homeassistant";
import { lastBackup } from "./backup";

/**
 * Host telemetry read directly from /proc and /sys (works on Raspberry Pi OS
 * and inside Docker with the default mounts). Every probe degrades to null
 * rather than throwing, so the panel always renders.
 */
function readFile(p: string): string | null {
  try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}

let lastCpu: { idle: number; total: number } | null = null;
function cpuSample() {
  const line = readFile("/proc/stat")?.split("\n")[0];
  if (!line) return null;
  const n = line.trim().split(/\s+/).slice(1).map(Number);
  const idle = n[3] + (n[4] ?? 0);
  const total = n.reduce((a, b) => a + b, 0);
  return { idle, total };
}

export function cpuPercent(): number | null {
  const now = cpuSample();
  if (!now) return null;
  const prev = lastCpu;
  lastCpu = now;
  if (!prev || now.total === prev.total) {
    const load = os.loadavg()[0] / os.cpus().length;
    return Math.min(100, Math.round(load * 100));
  }
  return Math.round(100 * (1 - (now.idle - prev.idle) / (now.total - prev.total)));
}

export function temperatureC(): number | null {
  for (const p of ["/sys/class/thermal/thermal_zone0/temp", "/sys/class/hwmon/hwmon0/temp1_input"]) {
    const v = readFile(p);
    if (v && !isNaN(+v)) return Math.round(+v / 100) / 10;
  }
  return null;
}

export function throttled(): string | null {
  // Pi firmware exposes under-voltage/throttle flags here when vcgencmd isn't available.
  const v = readFile("/sys/devices/platform/soc/soc:firmware/get_throttled");
  return v ? v.trim() : null;
}

export function memory() {
  const info = readFile("/proc/meminfo");
  if (!info) return { totalMb: Math.round(os.totalmem() / 1e6), usedMb: Math.round((os.totalmem() - os.freemem()) / 1e6) };
  const get = (k: string) => +(new RegExp(`${k}:\\s+(\\d+)`).exec(info)?.[1] ?? 0) / 1024;
  const total = get("MemTotal");
  return { totalMb: Math.round(total), usedMb: Math.round(total - get("MemAvailable")) };
}

export function storage() {
  try {
    const s = fs.statfsSync(env().dataDir);
    const total = s.blocks * s.bsize;
    return { totalGb: +(total / 1e9).toFixed(1), usedGb: +((total - s.bavail * s.bsize) / 1e9).toFixed(1) };
  } catch {
    return null;
  }
}

export function dbStats() {
  const size = fs.existsSync(env().dbPath) ? fs.statSync(env().dbPath).size : 0;
  const items = (db().prepare("SELECT COUNT(*) c FROM items").get() as { c: number }).c;
  const docs = (db().prepare("SELECT COUNT(*) c FROM documents").get() as { c: number }).c;
  return { sizeMb: +(size / 1e6).toFixed(2), items, documents: docs };
}

async function internet(): Promise<boolean> {
  try {
    const r = await fetch("https://api.open-meteo.com/", { method: "HEAD", signal: AbortSignal.timeout(2500) });
    return r.status < 500;
  } catch {
    return false;
  }
}

export async function healthReport() {
  const [ai, ha, online] = await Promise.all([
    aiStatus(),
    haConfigured() ? haPing() : Promise.resolve({ ok: false, message: "Not configured" }),
    internet(),
  ]);
  const nets = Object.entries(os.networkInterfaces())
    .flatMap(([name, addrs]) => (addrs ?? []).filter((a) => !a.internal && a.family === "IPv4").map((a) => ({ name, address: a.address })));
  return {
    host: { hostname: os.hostname(), platform: `${os.type()} ${os.release()}`, arch: os.arch(), uptimeH: Math.round(os.uptime() / 360) / 10, node: process.version },
    cpu: { percent: cpuPercent(), cores: os.cpus().length, load: os.loadavg().map((l) => +l.toFixed(2)) },
    temperatureC: temperatureC(),
    throttled: throttled(),
    memory: memory(),
    storage: storage(),
    database: dbStats(),
    network: { interfaces: nets, internet: online },
    services: [
      { name: "Hearth web", ok: true, message: `Up ${Math.round(process.uptime() / 60)} min` },
      { name: "AI orchestrator", ...ai.brain },
      ...ai.endpoints.map((e) => ({ name: e.role === "local" ? "Local model server" : "Remote GPU server", ok: e.ok, message: e.ok ? `${e.models.length} model(s)` : e.message })),
      { name: "Home Assistant", ...ha },
    ],
    ai,
    backup: lastBackup(),
    problems: log.recentProblems().slice(0, 50),
    version: process.env.HEARTH_VERSION ?? "0.1.0",
  };
}
