import { getSettings } from "../settings";
import { log } from "../log";

/** Open-Meteo: free, keyless. Requires internet; cached 15 minutes. */
export type Weather = {
  current: { temp: number; apparent: number; code: number; wind: number; humidity: number; isDay: boolean };
  daily: { date: string; max: number; min: number; code: number; precip: number }[];
  hourly: { time: string; temp: number; code: number; precip: number }[];
  unit: "°F" | "°C"; fetchedAt: number; location: string;
};

let cache: { key: string; at: number; data: Weather } | null = null;

export async function getWeather(): Promise<Weather | { unavailable: string }> {
  const s = getSettings();
  if (s.latitude == null || s.longitude == null) return { unavailable: "Set your home location in Settings to see weather." };
  const key = `${s.latitude},${s.longitude},${s.temperature_unit}`;
  if (cache && cache.key === key && Date.now() - cache.at < 15 * 60_000) return cache.data;
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(s.latitude), longitude: String(s.longitude), timezone: s.timezone,
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day",
    hourly: "temperature_2m,weather_code,precipitation_probability",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    temperature_unit: s.temperature_unit, wind_speed_unit: s.temperature_unit === "fahrenheit" ? "mph" : "kmh", forecast_days: "7",
  }).toString();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const nowIdx = Math.max(0, (j.hourly.time as string[]).findIndex((t) => t >= j.current.time.slice(0, 13)));
    const data: Weather = {
      current: { temp: j.current.temperature_2m, apparent: j.current.apparent_temperature, code: j.current.weather_code, wind: j.current.wind_speed_10m, humidity: j.current.relative_humidity_2m, isDay: !!j.current.is_day },
      daily: (j.daily.time as string[]).map((d, i) => ({ date: d, max: j.daily.temperature_2m_max[i], min: j.daily.temperature_2m_min[i], code: j.daily.weather_code[i], precip: j.daily.precipitation_probability_max[i] ?? 0 })),
      hourly: (j.hourly.time as string[]).slice(nowIdx, nowIdx + 12).map((t, i) => ({ time: t, temp: j.hourly.temperature_2m[nowIdx + i], code: j.hourly.weather_code[nowIdx + i], precip: j.hourly.precipitation_probability[nowIdx + i] ?? 0 })),
      unit: s.temperature_unit === "fahrenheit" ? "°F" : "°C", fetchedAt: Date.now(), location: s.location_label,
    };
    cache = { key, at: Date.now(), data };
    return data;
  } catch (e) {
    log.warn("weather.failed", { error: String(e) });
    if (cache?.key === key) return cache.data; // serve stale when offline
    return { unavailable: "Weather is unavailable — the forecast service could not be reached." };
  }
}

export function describeWeather(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorms";
}
