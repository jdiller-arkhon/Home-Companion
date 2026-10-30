import { requireUser } from "@/server/auth";
import { snapshot, briefingLines } from "@/server/briefing";
import { describeWeather } from "@/server/integrations/weather";
import { listDocs } from "@/server/vault";
import { relativeDay } from "@/lib/time";
import { Display } from "@/components/display";

export const dynamic = "force-dynamic";

export default async function DisplayPage() {
  const user = await requireUser();
  const s = await snapshot(user.id);
  const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: s.tz });
  const agenda = [...s.events, ...s.tasks].sort((a, b) => a.due_at! - b.due_at!).slice(0, 5).map((i) => {
    const day = relativeDay(i.kind === "event" || i.kind === "external" ? i.due_at! - (i.due_at! % 86_400_000) : i.due_at!, s.today);
    return { title: i.title, when: i.kind === "event" || i.kind === "external" ? `${day === "Today" ? "" : day + " "}${fmtTime(i.due_at!)}`.trim() : day };
  });
  const weather = "unavailable" in s.weather ? null : `${Math.round(s.weather.current.temp)}° ${describeWeather(s.weather.current.code)}`;
  // Photo frame: shared images in a Vault folder named “Photos”.
  const photos = listDocs(user.id, { folder: "Photos" }).filter((d) => d.visibility === "shared" && /^image\/(png|jpeg|webp)$/.test(d.mime)).slice(0, 60).map((d) => `/api/vault/${d.id}?inline`);
  return <Display tz={s.tz} weather={weather} agenda={agenda} lines={briefingLines(s)} photos={photos} />;
}
