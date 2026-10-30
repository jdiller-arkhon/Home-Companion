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

let current: HTMLAudioElement | null = null;
let generation = 0;

// ── Live loudness meter (drives Mabel's mouth) ─────────────────────────
type LevelFn = (level: number, speaking: boolean) => void;
const listeners = new Set<LevelFn>();
export function onLevel(fn: LevelFn) { listeners.add(fn); return () => { listeners.delete(fn); }; }
let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let raf = 0;
let smoothed = 0;

function meter(el: HTMLAudioElement) {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    if (!analyser) { analyser = ctx.createAnalyser(); analyser.fftSize = 512; analyser.connect(ctx.destination); }
    ctx.createMediaElementSource(el).connect(analyser);
  } catch { return; } // metering is decorative; playback still works without it
  const buf = new Uint8Array(analyser!.fftSize);
  cancelAnimationFrame(raf);
  const tick = () => {
    analyser!.getByteTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) { const x = (v - 128) / 128; sum += x * x; }
    const rms = Math.sqrt(sum / buf.length);
    // Fast attack, slower release: lips snap open on syllables and ease shut.
    smoothed = rms > smoothed ? smoothed + (rms - smoothed) * 0.6 : smoothed + (rms - smoothed) * 0.25;
    listeners.forEach((f) => f(smoothed, true));
    raf = requestAnimationFrame(tick);
  };
  tick();
}
function meterStop() { cancelAnimationFrame(raf); smoothed = 0; listeners.forEach((f) => f(0, false)); }

async function synth(text: string, voice?: string): Promise<string> {
  const r = await fetch("/api/voice/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice }) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Voice unavailable");
  return URL.createObjectURL(await r.blob());
}

/** Splits a reply into speakable chunks (sentences, merged up to ~220 chars). */
export function sentences(text: string): string[] {
  const parts = text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [text];
  const out: string[] = [];
  for (const p of parts.map((x) => x.trim()).filter(Boolean)) {
    if (out.length && out[out.length - 1].length + p.length < 220 && out.length > 1) out[out.length - 1] += " " + p;
    else out.push(p);
  }
  return out;
}

/**
 * Speaks text sentence by sentence: the first sentence starts as soon as it's
 * synthesised while the next one is prepared in the background — so natural
 * (slower) voices still feel instant, even on a Raspberry Pi.
 */
export async function say(text: string, voice?: string) {
  hush();
  const gen = ++generation;
  const chunks = sentences(text);
  let next = synth(chunks[0], voice);
  try {
  for (let i = 0; i < chunks.length; i++) {
    const url = await next;
    if (gen !== generation) return;
    if (i + 1 < chunks.length) next = synth(chunks[i + 1], voice);
    current = new Audio(url);
    meter(current);
    await new Promise<void>((resolve, reject) => {
      current!.onended = () => resolve();
      current!.onerror = () => reject(new Error("Playback failed"));
      current!.play().catch(reject);
    });
    URL.revokeObjectURL(url);
  }
  } finally {
    if (gen === generation) meterStop();
  }
}
export function hush() { generation++; current?.pause(); meterStop(); }
