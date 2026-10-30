# Implementation status

Legend: ✅ working and tested · 🟡 working, not verified against real hardware or service · ⏳ not built yet

| Module | Status | Notes |
|---|---|---|
| Design system (light/dark, Geist, motion, reduced motion) | ✅ | Tokens in `web/src/app/globals.css` |
| Onboarding, sign-in, two profiles, private/shared data | ✅ | e2e test verifies privacy across profiles |
| PIN / step-up auth, rate limiting, audit log | ✅ | |
| Today dashboard + deterministic briefing | ✅ | Works with no AI and no internet |
| Planner (month calendar, tasks, groceries, meals, recipes, chores, errands, occasions, notes, goals) | ✅ | Month grid shows events, tasks, chores, bills, upkeep and yearly occasions |
| Finance (accounts, bills, subscriptions, spending, budgets, savings, trend) | ✅ | Wescom/any bank: OFX/QFX/CSV statement import with dedupe, auto-categories and balance-as-of. Automatic sync (SimpleFIN, ~$15/yr) ⏳ awaiting your go-ahead. Plaid not recommended for a household |
| Upkeep (maintenance, appliances/warranties, vehicles, repairs, supplies) | ✅ | Manuals as links; uploading manuals goes in the Vault |
| Packages | ✅ | Carrier auto-detection + tracking links; paste a shipping email to extract tracking/merchant/date (pattern-based, injection-safe). Live carrier status APIs ⏳ (require business API accounts) |
| Vault (encryption, folders, sharing, expiry, search, export) | ✅ | |
| Vault OCR | 🟡 | PDF text layer, scanned PDFs (pdfium → Tesseract) and images. OCR test runs only where Tesseract is installed (the brain image) |
| Realtime collaboration | ✅ | Server-sent events refresh every open screen |
| System health, backups | ✅ / 🟡 | Pi thermal and throttle readings not yet verified on real Pi hardware |
| Settings (household, people, HA, AI, profile, notifications) | ✅ | |
| Notifications (in-app inbox + Web Push) | ✅ / 🟡 | Reminder engine tested (bills, renewals, tasks, packages, upkeep, warranties, low stock, occasions, document expiry, night security check). Push delivery needs a real iPhone with Hearth on the Home Screen (iOS 16.4+) |
| Smart home via Home Assistant | 🟡 | Devices, floor plan (encrypted image + device pins, tap to toggle) and routines (time + days + presence, safe actions only, run-now, failure alerts). Engine unit-tested; not yet tested against a live HA |
| Assistant (local Ollama, tools, streaming, memory, history, approvals) | 🟡 | Policy gate unit-tested; orchestration loop tested with a scripted model; not yet run against a real Ollama model |
| Voice (Whisper STT, Piper TTS, voice picker) | 🟡 | Code complete; needs the brain container with voice models to verify. Wake word: not possible in iPhone/iPad Safari (no background mic); would need a dedicated mic device (e.g. a Pi + openWakeWord) |
| Morning briefing / evening recap | ✅ / 🟡 | Sent as notifications at the configured hour; push delivery needs a real device |
| PWA install, offline fallback, icons | ✅ | Requires the HTTPS certificate step on iOS |
| Docker Compose deployment for Pi (arm64) | 🟡 | Images are multi-arch by design; not yet built on a physical Pi |

## Tests
* `web`: 24 unit tests (records, validation, privacy, recurrence, AI permission gate, taint escalation, injection wrapper, reminders, routines, tracking extraction, OFX/CSV import)
* `web/e2e`: 9 Playwright flows (onboarding, forms and validation, finance mark-paid, statement import, vault upload and search, month calendar, email paste, AI-offline fallback, iPhone layout, cross-profile privacy, API auth)
* `brain`: 4 tests (taint propagation, step limit, scanned-PDF OCR where Tesseract exists, unsupported types)

## Known blockers / decisions for you
1. **Automatic bank sync** (SimpleFIN Bridge, ~$15/yr, read-only): not added; your call. Statement import works today for free.
2. **Push notifications** on iPhone require Hearth installed to the Home Screen, then Settings → Notifications → Enable on this device.
3. Real-hardware verification (Pi, Home Assistant, Ollama, voice) needs your devices.
