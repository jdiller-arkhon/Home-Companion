"use client";

/** Push-to-talk recorder → local Whisper; reply playback via local Piper. */
export class Recorder {
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser can't record audio (HTTPS is required).");
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((t) => MediaRecorder.isTypeSupported(t));
    this.rec = new MediaRecorder(this.stream, type ? { mimeType: type } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start();
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.rec) return resolve(new Blob());
      this.rec.onstop = () => {
        this.stream?.getTracks().forEach((t) => t.stop());
        resolve(new Blob(this.chunks, { type: this.rec!.mimeType }));
      };
      this.rec.stop();
    });
  }
}

export async function transcribe(blob: Blob): Promise<string> {
  const fd = new FormData();
  fd.append("audio", blob, "speech");
  const r = await fetch("/api/voice/stt", { method: "POST", body: fd });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? "Couldn't understand that.");
  return j.text as string;
}

// ── Speech output ──────────────────────────────────────────────────────
// One Web Audio timeline: each sentence is synthesised (two ahead), trimmed of
// edge silence, given a few-ms fade, and scheduled back-to-back with a natural
// pause — no gaps, clicks, or per-chunk <audio> elements. A shared analyser
// drives Mabel's mouth (level + timbre-based shape).
type LevelFn = (level: number, speaking: boolean, shape: number) => void;
const listeners = new Set<LevelFn>();
export function onLevel(fn: LevelFn) { listeners.add(fn); return () => { listeners.delete(fn); }; }

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
let analyser: AnalyserNode | null = null;
let raf = 0, smoothed = 0, shapeS = 0.5;
let nextStart = 0;
let sources: AudioBufferSourceNode[] = [];
let generation = 0;
let pending: Promise<unknown> = Promise.resolve();
let inflight = 0;

/** Call synchronously inside a tap/click so iOS allows audio that starts later. */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    ctx = new AudioContext();
    out = ctx.createGain();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.5;
    out.connect(analyser);
    analyser.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
}

function startMeter() {
  if (raf || !analyser || !ctx) return;
  const buf = new Uint8Array(analyser.fftSize);
  const spec = new Uint8Array(analyser.frequencyBinCount);
  const hz = ctx.sampleRate / analyser.fftSize;
  const band = (lo: number, hi: number) => { let s = 0, n = 0; for (let i = Math.floor(lo / hz); i <= Math.min(spec.length - 1, hi / hz); i++) { s += spec[i]; n++; } return n ? s / n : 0; };
  const tick = () => {
    analyser!.getByteTimeDomainData(buf);
    analyser!.getByteFrequencyData(spec);
    let sum = 0;
    for (const v of buf) { const x = (v - 128) / 128; sum += x * x; }
    const rms = Math.sqrt(sum / buf.length);
    // Fast attack, slower release: lips open on syllables and ease shut.
    smoothed = rms > smoothed ? smoothed + (rms - smoothed) * 0.6 : smoothed + (rms - smoothed) * 0.22;
    // Timbre → mouth shape: bright (ee, s) wide; dark (oo, o) round.
    const low = band(250, 900), high = band(1800, 4500);
    const bright = low + high > 8 ? high / (low + high) : 0.5;
    shapeS += (Math.min(1, Math.max(0, (bright - 0.15) * 2.4)) - shapeS) * 0.3;
    const speaking = ctx!.currentTime < nextStart + 0.05;
    listeners.forEach((f) => f(speaking ? smoothed : 0, speaking, shapeS));
    if (!speaking && smoothed < 0.002) { raf = 0; return; }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

async function synth(text: string, voice?: string): Promise<ArrayBuffer> {
  const r = await fetch("/api/voice/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice }) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Voice unavailable");
  return r.arrayBuffer();
}

/** Trims leading/trailing near-silence so sentences join naturally. */
function trimmed(b: AudioBuffer): { offset: number; duration: number } {
  const d = b.getChannelData(0), thr = 0.012, pad = Math.floor(b.sampleRate * 0.03);
  let s = 0, e = d.length - 1;
  while (s < e && Math.abs(d[s]) < thr) s++;
  while (e > s && Math.abs(d[e]) < thr) e--;
  s = Math.max(0, s - pad); e = Math.min(d.length - 1, e + pad);
  return { offset: s / b.sampleRate, duration: Math.max(0.05, (e - s) / b.sampleRate) };
}

const pauseAfter = (t: string) => (/[.!?]["')\]]*$/.test(t) ? 0.24 : /[,;:—–-]$/.test(t) ? 0.1 : 0.12);

/** Queues one sentence: synthesis starts now (max two ahead); playback is scheduled in order. */
function enqueue(text: string, voice?: string, gen = generation) {
  unlockAudio();
  const job = (async () => {
    while (inflight >= 2) await new Promise((r) => setTimeout(r, 40));
    inflight++;
    try { return await synth(text, voice); } finally { inflight--; }
  })();
  pending = pending.then(async () => {
    let data: ArrayBuffer;
    try { data = await job; } catch (e) { listeners.forEach((f) => f(0, false, 0.5)); throw e; }
    if (gen !== generation || !ctx || !out) return;
    const buffer = await ctx.decodeAudioData(data);
    if (gen !== generation) return;
    const { offset, duration } = trimmed(buffer);
    const src = ctx.createBufferSource();
    const env = ctx.createGain();
    src.buffer = buffer;
    src.connect(env).connect(out);
    const at = Math.max(ctx.currentTime + 0.04, nextStart);
    const fade = 0.012;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(1, at + fade);
    env.gain.setValueAtTime(1, at + duration - fade);
    env.gain.linearRampToValueAtTime(0, at + duration);
    src.start(at, offset, duration);
    sources.push(src);
    src.onended = () => { sources = sources.filter((x) => x !== src); };
    nextStart = at + duration + pauseAfter(text);
    startMeter();
  }).catch(() => {});
}

/** Splits a reply into speakable chunks: first one short (starts fast), then 1–2 sentences each. */
export function sentences(text: string): string[] {
  const parts = text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [text];
  const out: string[] = [];
  for (const p of parts.map((x) => x.trim()).filter(Boolean)) {
    if (out.length > 1 && out[out.length - 1].length + p.length < 160) out[out.length - 1] += " " + p;
    else out.push(p);
  }
  return out;
}

/** Speaks a complete text. */
export async function say(text: string, voice?: string) {
  hush();
  for (const c of sentences(text)) enqueue(c, voice);
  await pending;
}

/**
 * Speaks text *as it streams in*: each sentence is voiced as soon as it is
 * complete, while the model is still writing the rest.
 */
export function speechStream(voice?: string) {
  hush();
  const gen = generation;
  let buf = "", count = 0;
  const flush = (force: boolean) => {
    const strip = (s: string) => s.replace(/[•*#_`]/g, "").trim();
    for (;;) {
      const m = /^([\s\S]*?[.!?]["')\]]*)(\s+)/.exec(buf);
      if (!m) break;
      // Speak the first sentence right away; later, wait for ~60 chars so chunks sound natural.
      if (count > 0 && m[1].length < 60 && !force) {
        const m2 = /^([\s\S]*?[.!?]["')\]]*\s+[\s\S]*?[.!?]["')\]]*)(\s+)/.exec(buf);
        if (!m2) break;
        enqueue(strip(m2[1]), voice, gen); buf = buf.slice(m2[0].length); count++; continue;
      }
      enqueue(strip(m[1]), voice, gen); buf = buf.slice(m[0].length); count++;
    }
    if (force && strip(buf)) { enqueue(strip(buf), voice, gen); buf = ""; }
  };
  return {
    push(token: string) { if (gen === generation) { buf += token; flush(false); } },
    end() { if (gen === generation) flush(true); return pending; },
  };
}

export function hush() {
  generation++;
  for (const s of sources) { try { s.stop(); } catch {} }
  sources = [];
  pending = Promise.resolve();
  if (ctx) nextStart = ctx.currentTime;
  listeners.forEach((f) => f(0, false, 0.5));
}
