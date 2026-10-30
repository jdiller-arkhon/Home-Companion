"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUp, Mic, Sparkles, ShieldAlert, Check, X, Square, Volume2 } from "lucide-react";
import clsx from "clsx";
import { ElevateDialog } from "./elevate";
import { Recorder, transcribe, say, hush, onLevel } from "./voice";
import { Mabel, type MabelState } from "./mabel";
import { AnimatePresence, motion } from "motion/react";

export type ChatMsg = { role: "user" | "assistant" | "tool"; content: string };
export type Action = { id: string; summary: string; level: string };


export function Assistant({ conversationId, initial, actions, suggestions, name }: { conversationId?: string; initial: ChatMsg[]; actions: Action[]; suggestions: string[]; name: string }) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<ChatMsg[]>(initial);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>();
  const [convId, setConvId] = useState(conversationId);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(false);
  const [elev, setElev] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const rec = useRef<Recorder | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const [level, setLevel] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [streaming, setStreaming] = useState(false);
  useEffect(() => onLevel((l, s) => { setLevel(l); setSpeaking(s); }), []);
  const mabelState: MabelState = listening ? "listening" : speaking ? "speaking" : busy ? "thinking" : "idle";
  const statusText = { listening: "Listening…", thinking: "Thinking…", speaking: "Speaking", idle: "" }[mabelState];

  useEffect(() => { setMsgs(initial); setConvId(conversationId); }, [initial, conversationId]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, actions]);

  async function send(text: string, viaVoice = false) {
    if (!text.trim() || busy) return;
    setInput(""); setBusy(true); setStreaming(false); setStatus(undefined);
    setMsgs((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    abort.current = new AbortController();
    let full = "";
    try {
      const r = await fetch("/api/assistant/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: convId, message: text }), signal: abort.current.signal });
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n"); buf = parts.pop()!;
        for (const p of parts) {
          if (!p.startsWith("data: ")) continue;
          const ev = JSON.parse(p.slice(6));
          if (ev.type === "conversation") {
            setConvId(ev.id);
            // Give a new chat its own address so refreshes (and the back button) keep it on screen.
            if (!convId) window.history.replaceState(null, "", `/assistant?c=${ev.id}`);
          }
          else if (ev.type === "token") { full += ev.text; setStreaming(true); setMsgs((m) => [...m.slice(0, -1), { role: "assistant", content: full }]); }
          else if (ev.type === "tool") setStatus(ev.status === "needs_confirmation" ? `Waiting for your approval: ${ev.summary}` : ev.status === "running" ? `Working: ${ev.summary ?? ev.name}…` : undefined);
          else if (ev.type === "error") setStatus(ev.message);
        }
      }
      if ((speak || viaVoice) && full) say(full.replace(/[•*#]/g, "")).catch((e) => setStatus(e.message));
    } catch (e) {
      if ((e as Error).name !== "AbortError") setStatus("Couldn't reach Hearth. Check your connection.");
    } finally {
      setBusy(false); abort.current = null; router.refresh();
    }
  }

  async function resolve(id: string, approve: boolean) {
    const r = await fetch(`/api/actions/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approve }) }).then((x) => x.json());
    if (r.status === "error" && /PIN or password/.test(r.error)) return setElev(id);
    if (r.status === "error") setStatus(r.error);
    router.refresh();
  }

  // Push-to-talk: tap to start, tap again to send. Spoken questions get spoken answers.
  async function voice() {
    if (listening) {
      setListening(false);
      const blob = await rec.current!.stop();
      setStatus("Transcribing…");
      try {
        const text = await transcribe(blob);
        setStatus(undefined);
        if (text) send(text, true); else setStatus("I didn't catch that.");
      } catch (e) { setStatus((e as Error).message); }
      return;
    }
    hush();
    try { rec.current = new Recorder(); await rec.current.start(); setListening(true); setStatus("Listening… tap the mic again when you're done."); }
    catch (e) { setStatus((e as Error).message); }
  }

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col md:min-h-dvh">
      <div className="flex-1 space-y-6 pb-6">
        {msgs.length === 0 && (
          <div className="pt-6 text-center">
            <motion.div initial={{ opacity: 0, scale: 0.85, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} className="mx-auto w-fit">
              <Mabel state={mabelState} level={level} size={168} />
            </motion.div>
            <h2 className="mt-4 text-[22px] font-semibold tracking-tight">Hi, I'm {name}. How can I help?</h2>
            <p className="mt-1 text-[14px] text-fg-2">I can plan, remember, look things up in your vault and control the house — sensitive actions always ask first.</p>
            <div className="mx-auto mt-6 flex max-w-[560px] flex-wrap justify-center gap-2">
              {suggestions.map((s) => <button key={s} onClick={() => send(s)} className="press rounded-full border border-line px-3.5 py-1.5 text-[13px] text-fg-2 hover:bg-fill hover:text-fg">{s}</button>)}
            </div>
          </div>
        )}
        <AnimatePresence>
          {msgs.length > 0 && (
            <motion.div key="mabel-bar" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="glass sticky top-0 z-10 -mx-2 flex items-center gap-3 rounded-b-2xl px-2 py-2">
              <Mabel state={mabelState} level={level} size={52} />
              <div className="min-w-0">
                <div className="text-[14px] font-semibold tracking-tight">{name}</div>
                <AnimatePresence mode="wait">
                  <motion.div key={statusText || "online"} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} transition={{ duration: 0.18 }}
                    className="text-[12px] text-fg-3">{statusText || "Here when you need me"}</motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {msgs.map((m, i) => (
          <div key={i} className={clsx("rise flex", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "tool" ? (
              <p className="flex items-center gap-1.5 text-[12px] text-fg-3"><Check size={12} className="text-ok" />{m.content}</p>
            ) : (
              <div className={clsx("max-w-[85%] whitespace-pre-wrap text-[15px] leading-relaxed", m.role === "user" ? "rounded-[18px] rounded-br-md bg-fg px-4 py-2.5 text-bg" : "text-fg")}>
                {m.content || <span className="inline-flex gap-1 py-2">{[0, 1, 2].map((d) => <span key={d} className="size-1.5 animate-pulse rounded-full bg-fg-3" style={{ animationDelay: `${d * 150}ms` }} />)}</span>}
              </div>
            )}
          </div>
        ))}
        {actions.map((a) => (
          <div key={a.id} className="card rise border-accent/30 p-4" style={{ borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)" }}>
            <div className="flex items-center gap-2 text-[12px] font-medium text-accent"><ShieldAlert size={14} />{a.level === "elevated" ? "Needs your approval and PIN" : "Needs your approval"}</div>
            <p className="mt-2 text-[15px]">{a.summary}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => resolve(a.id, true)} className="press inline-flex items-center gap-1.5 rounded-[10px] bg-fg px-3.5 py-2 text-[13px] font-medium text-bg"><Check size={14} />Approve</button>
              <button onClick={() => resolve(a.id, false)} className="press inline-flex items-center gap-1.5 rounded-[10px] border border-line px-3.5 py-2 text-[13px]"><X size={14} />Decline</button>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="sticky bottom-24 md:bottom-6">
        {status && <p className="mb-2 text-center text-[12px] text-fg-3" role="status">{status}</p>}
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="glass card flex items-end gap-2 p-2">
          <button type="button" onClick={voice} aria-label={listening ? "Stop listening" : "Speak"} className={clsx("press grid size-9 shrink-0 place-items-center rounded-full", listening ? "bg-bad text-white" : "text-fg-2 hover:bg-fill")}><Mic size={17} /></button>
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} placeholder={`Ask ${name} anything…`} aria-label="Message"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-[15px] outline-none" />
          <button type="button" onClick={() => setSpeak(!speak)} aria-pressed={speak} aria-label="Read replies aloud" className={clsx("press grid size-9 shrink-0 place-items-center rounded-full", speak ? "text-accent" : "text-fg-3 hover:bg-fill")}><Volume2 size={16} /></button>
          {busy ? (
            <button type="button" onClick={() => abort.current?.abort()} aria-label="Stop" className="press grid size-9 shrink-0 place-items-center rounded-full bg-fg text-bg"><Square size={13} /></button>
          ) : (
            <button disabled={!input.trim()} aria-label="Send" className="press grid size-9 shrink-0 place-items-center rounded-full bg-fg text-bg disabled:opacity-30"><ArrowUp size={17} /></button>
          )}
        </form>
      </div>
      <ElevateDialog open={!!elev} onOpenChange={(o) => !o && setElev(null)} reason="This action affects home security or your records." onDone={() => elev && resolve(elev, true)} />
    </div>
  );
}

export function NewChatLink() {
  return <Link href="/assistant?new=1" className="press rounded-[10px] border border-line px-3 py-1.5 text-[13px] hover:bg-fill">New chat</Link>;
}
