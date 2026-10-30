"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { X } from "lucide-react";

type Agenda = { title: string; when: string }[];

/** Calm always-on screen. Idle → photo frame (dimmed); tap or motion → wake. */
export function Display({ tz, weather, agenda, lines, photos }: { tz: string; weather: string | null; agenda: Agenda; lines: string[]; photos: string[] }) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const [awake, setAwake] = useState(true);
  const [last, setLast] = useState(() => Date.now());
  const [photo, setPhoto] = useState(0);

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(() => router.refresh(), 5 * 60_000); return () => clearInterval(t); }, [router]);
  useEffect(() => { if (Date.now() - last > 120_000 && awake) setAwake(false); }, [now, last, awake]);
  useEffect(() => { if (!awake && photos.length) { const t = setInterval(() => setPhoto((p) => (p + 1) % photos.length), 15_000); return () => clearInterval(t); } }, [awake, photos.length]);
  useEffect(() => {
    const t = setInterval(async () => {
      const r = await fetch("/api/display").then((x) => x.json()).catch(() => null);
      if (r?.motion) { setAwake(true); setLast(Date.now()); }
    }, 5000);
    return () => clearInterval(t);
  }, []);
  // Keep the screen on while the display is open (where the browser supports it).
  useEffect(() => {
    let lock: { release(): Promise<void> } | null = null;
    (navigator as unknown as { wakeLock?: { request(t: string): Promise<{ release(): Promise<void> }> } }).wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => { lock?.release(); };
  }, []);

  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).replace(/\s?[AP]M/, "");
  const date = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: tz });

  return (
    <div onPointerDown={() => { setAwake(true); setLast(Date.now()); }} className="fixed inset-0 select-none overflow-hidden bg-black text-white">
      {photos.length > 0 && photos.map((p, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={p} src={p} alt="" className={clsx("absolute inset-0 size-full object-cover transition-opacity duration-[2000ms]", i === photo && !awake ? "opacity-60" : "opacity-0")} />
      ))}
      <div className={clsx("absolute inset-0 transition-opacity duration-700", awake ? "opacity-100" : "opacity-0")}>
        <div className="absolute inset-0 bg-gradient-to-b from-[#16161a] to-black" />
      </div>
      <Link href="/" aria-label="Exit display" className={clsx("absolute right-6 top-6 z-10 rounded-full p-2 text-white/40 hover:text-white", !awake && "hidden")}><X size={20} /></Link>
      <div className="relative flex h-full flex-col justify-between p-10 md:p-16">
        <div>
          <div className="tnum text-[96px] md:text-[140px] font-semibold leading-none tracking-[-0.05em]">{time}</div>
          <div className="mt-3 text-[22px] text-white/60">{date}{weather ? ` · ${weather}` : ""}</div>
        </div>
        <div className={clsx("grid gap-10 transition-opacity duration-700 md:grid-cols-2", awake ? "opacity-100" : "opacity-0")}>
          <div>
            <p className="text-[12px] uppercase tracking-[0.08em] text-white/40">Up next</p>
            <ul className="mt-3 space-y-2.5 text-[20px]">
              {agenda.length ? agenda.map((a) => <li key={a.title + a.when} className="flex gap-4"><span className="w-28 shrink-0 text-white/50">{a.when}</span><span className="truncate">{a.title}</span></li>)
                : <li className="text-white/50">Nothing scheduled.</li>}
            </ul>
          </div>
          <div>
            <p className="text-[12px] uppercase tracking-[0.08em] text-[#9aa1ff]">Briefing</p>
            <ul className="mt-3 space-y-2 text-[17px] leading-snug text-white/80">{lines.slice(0, 4).map((l) => <li key={l}>{l}</li>)}</ul>
          </div>
        </div>
      </div>
    </div>
  );
}
