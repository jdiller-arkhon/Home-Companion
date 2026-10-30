# Voice

Fully local: **Whisper** (faster-whisper) turns speech into text. Replies are spoken by **Kokoro** (natural, default) or **Piper** (fast, robotic-ish fallback). Audio is processed in memory and never stored or sent off the network.

* Tap the **mic** in the Assistant, speak, then tap again. Spoken questions get spoken answers (and text). The speaker button toggles reading typed replies aloud.
* Choose the assistant's **name and voice** in Settings → Assistant; **Preview** plays a sample. Samples of every voice are in `docs/voice-samples/` (natural ones in `natural/`).
  * Natural (Kokoro): Heart, Bella, Nicole, Emma (UK) — female; Michael, Fenrir, George (UK) — male.
  * Fast (Piper): Amy, Lessac, Alba — female; Ryan, Joe, Northern — male.
* Speed: Kokoro measured ~3× faster than realtime on a 4-core desktop CPU; on a Pi 5 expect roughly realtime (estimate — not yet measured). Replies are spoken sentence by sentence so the first words start within a second or two. If a GPU computer is configured it's faster still. If Kokoro isn't available Hearth falls back to Piper automatically.
* Accuracy vs speed: set `HEARTH_WHISPER_MODEL` in `deploy/.env`: `tiny.en` (fastest on a Pi), `base.en` (default), `small.en` (best, slower).
* Microphone access needs HTTPS, so complete the certificate step in INSTALL.md.

Not yet available: an always-listening wake word ("Hey …"). It's planned via openWakeWord on a dedicated mic; on iPhone/iPad, Safari doesn't allow background listening anyway.
