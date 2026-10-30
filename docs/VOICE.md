# Voice

Fully local: **Whisper** (faster-whisper) turns speech into text, and **Piper** speaks replies. Audio is processed in memory and never stored or sent off the network.

* Tap the **mic** in the Assistant, speak, then tap again. Spoken questions get spoken answers (and text). The speaker button toggles reading typed replies aloud.
* Choose the assistant's **name and voice** in Settings → Assistant; **Preview** plays a sample. Included voices: Amy, Lessac, Alba (female); Ryan, Joe, Northern English (male).
* Accuracy vs speed: set `HEARTH_WHISPER_MODEL` in `deploy/.env`: `tiny.en` (fastest on a Pi), `base.en` (default), `small.en` (best, slower).
* Microphone access needs HTTPS, so complete the certificate step in INSTALL.md.

Not yet available: an always-listening wake word ("Hey …"). It's planned via openWakeWord on a dedicated mic; on iPhone/iPad, Safari doesn't allow background listening anyway.
