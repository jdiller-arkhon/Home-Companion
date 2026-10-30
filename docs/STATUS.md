# Implementation status

Legend: ✅ working and tested · 🟡 working, not verified against real hardware or service · ⏳ not built yet

| Module | Status | Notes |
|---|---|---|
| Design system (light/dark, Geist, motion, reduced motion) | ✅ | Tokens in `web/src/app/globals.css` |
| Onboarding, sign-in, two profiles, private/shared data | ✅ | e2e test verifies privacy across profiles |
| PIN / step-up auth, rate limiting, audit log | ✅ | |
| Today dashboard + deterministic briefing | ✅ | Works with no AI and no internet |
| Planner (calendar, tasks, groceries, meals, recipes, chores, errands, occasions, notes, goals) | ✅ | Calendar is a list view; no month grid yet |
| Finance (bills, subscriptions, spending, budgets, savings, trend) | ✅ | Manual entry. Bank integrations ⏳ (would need a paid aggregator; asking first) |
| Upkeep (maintenance, appliances/warranties, vehicles, repairs, supplies) | ✅ | Manuals as links; uploading manuals goes in the Vault |
| Packages | ✅ | Manual entry. Carrier APIs and email extraction ⏳ |
| Vault (encryption, folders, sharing, expiry, search, export) | ✅ | |
| Vault OCR | 🟡 | PDF text and Tesseract image OCR in the brain container. Scanned-PDF OCR ⏳ |
| Realtime collaboration | ✅ | Server-sent events refresh every open screen |
| System health, backups | ✅ / 🟡 | Pi thermal and throttle readings not yet verified on real Pi hardware |
| Settings (household, people, HA, AI, profile, notifications) | ✅ | Notification *delivery* (Web Push) ⏳; preferences are saved |
| Smart home via Home Assistant | 🟡 | Client and UI complete; not yet tested against a live HA. Floor plan ⏳. Own automation engine ⏳ (use HA automations/scenes, triggerable from Hearth) |
| Assistant (local Ollama, tools, streaming, memory, history, approvals) | 🟡 | Policy gate unit-tested; orchestration loop tested with a scripted model; not yet run against a real Ollama model |
| Voice (Whisper STT, Piper TTS, voice picker) | 🟡 | Code complete; needs the brain container with voice models to verify. Wake word ⏳ |
| Evening recap / scheduled proactive briefings | ⏳ | Setting stored; delivery depends on Web Push |
| PWA install, offline fallback, icons | ✅ | Requires the HTTPS certificate step on iOS |
| Docker Compose deployment for Pi (arm64) | 🟡 | Images are multi-arch by design; not yet built on a physical Pi |

## Tests
* `web`: 14 unit tests (records, validation, privacy, recurrence, AI permission gate, taint escalation, injection wrapper)
* `web/e2e`: 8 Playwright flows (onboarding, forms and validation, finance mark-paid, vault upload and search, AI-offline fallback, iPhone layout, cross-profile privacy, API auth)
* `brain`: 2 tests (taint propagation, step limit)

## Known blockers / decisions for you
1. **Bank integrations** need a paid service (e.g. Plaid/SimpleFIN). Not added; your call.
2. **Push notifications** to iPhone need Web Push with VAPID keys (free) and the app installed to the Home Screen. Next on the list.
3. Real-hardware verification (Pi, Home Assistant, Ollama, voice) needs your devices.
