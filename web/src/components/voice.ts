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
export async function say(text: string, voice?: string) {
  current?.pause();
  const r = await fetch("/api/voice/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice }) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Voice unavailable");
  current = new Audio(URL.createObjectURL(await r.blob()));
  await current.play();
}
export function hush() { current?.pause(); }
