# Implementation status

Legend: ✅ working and tested · 🟡 working, not verified against real hardware or service · ⏳ not built yet

| Module | Status | Notes |
|---|---|---|
| Design system (light/dark, Geist, motion, reduced motion) | ✅ | Tokens in `web/src/app/globals.css` |
| Onboarding, sign-in, two profiles, private/shared data | ✅ | e2e test verifies privacy across profiles |
| PIN / step-up auth, rate limiting, audit log | ✅ | |
| Today dashboard + deterministic briefing | ✅ | Works with no AI and no internet. Finance removed at your request |
| Planner (month calendar, tasks, groceries, meals, recipes, chores, errands, occasions, notes, goals) | ✅ | Month grid shows events, tasks, chores, bills, upkeep and yearly occasions |
| Upkeep (maintenance, appliances/warranties, vehicles, repairs, supplies) | ✅ | Manuals as links; uploading manuals goes in the Vault |
| Packages | ✅ | Carrier auto-detection + tracking links; paste a shipping email to extract tracking/merchant/date (pattern-based, injection-safe). Live carrier status APIs ⏳ (require business API accounts) |
| Vault (encryption, folders, sharing, expiry, search, export) | ✅ | |
| Vault OCR | 🟡 | PDF text layer, scanned PDFs (pdfium → Tesseract) and images. OCR test runs only where Tesseract is installed (the brain image) |
| Realtime collaboration | ✅ | Live updates, “ask the household” nudges, done-by attribution |
| System health, backups | ✅ / 🟡 | Pi thermal and throttle readings not yet verified on real Pi hardware |
| Settings (household, people, HA, AI, profile, notifications) | ✅ | |
| Notifications (in-app inbox + Web Push) | ✅ / 🟡 | Reminder engine tested (bills, renewals, tasks, packages, upkeep, warranties, low stock, occasions, document expiry, night security check). Push delivery needs a real iPhone with Hearth on the Home Screen (iOS 16.4+) |
| Smart home via Home Assistant | 🟡 | Devices, floor plan (encrypted image + device pins, tap to toggle) and routines (time + days + presence, safe actions only, run-now, failure alerts). Engine unit-tested; not yet tested against a live HA |
| Assistant (local Ollama, tools, streaming, memory, history, approvals) | 🟡 | Policy gate unit-tested; orchestration loop tested with a scripted model; not yet run against a real Ollama model |
| Voice (Whisper STT, Piper TTS, voice picker) | 🟡 | Code complete; needs the brain container with voice models to verify. Wake word: not possible in iPhone/iPad Safari (no background mic); would need a dedicated mic device (e.g. a Pi + openWakeWord) |
| Morning briefing / evening recap | ✅ / 🟡 | Sent as notifications at the configured hour; push delivery needs a real device |
| PWA install, offline fallback, icons | ✅ | Requires the HTTPS certificate step on iOS |
| Docker Compose deployment for Pi (arm64) | 🟡 | Images are multi-arch by design; not yet built on a physical Pi |

| Calendar sync | ✅ | Per-person iCal feed (webcal), subscribed iCloud/Google calendars merged into month view, agenda and briefing. Tested with a generated feed; not yet with real iCloud/Google URLs |
| Siri & Shortcuts | ✅ / 🟡 | Endpoint, per-device keys, instant command parsing tested; Shortcut building on a real iPhone not yet done |
| Semantic document search | 🟡 | Needs `ollama pull nomic-embed-text`; falls back to keyword search automatically |
| Photo capture (receipts/labels → appliance + warranty) | ✅ / 🟡 | Flow and pattern extraction tested; OCR + model structuring need the brain container |
| Grocery intelligence | ✅ | Store-section grouping, auto-sections, learned purchase rhythm, recipe → groceries |
| Leaving / arriving routines | 🟡 | Engine tested with simulated presence; needs HA person entities (phones with the HA app) |
| Display mode | ✅ / 🟡 | Clock, agenda, briefing, photo frame (Vault folder “Photos”), tap wake; motion wake needs an HA motion sensor |
| Year in review | ✅ | Printable |
| Emergency card + sitter links | ✅ | Expiring, revocable, read-only, audited |
| Premium motion | ✅ | Page transitions, sliding nav/tabs, spring sheets, animated rows, instant check-off, skeletons; Reduce Motion respected |
| Pi touchscreen appliance | 🟡 | `scripts/kiosk-setup.sh` written; not yet run on a Pi |
| Hearth OS image | 🟡 | pi-gen recipe in `os/`; not yet built |
| iPad as a dedicated device | ✅ | Home Screen app + Guided Access (Apple doesn't allow replacing iPadOS) |

## Tests
* `web`: 36 unit tests (records, privacy, recurrence, AI permission gate, taint escalation, injection wrapper, reminders, routines incl. presence, tracking, iCal read/write/recurrence, voice commands, ingredients and grocery rhythm, receipt extraction)
* `web/e2e`: 11 Playwright flows (onboarding, forms, records, vault, month calendar, email paste, Siri key + commands, calendar feed, emergency share + revoke, display, report, photo capture without AI, AI-offline fallback, iPhone layout, cross-profile privacy, API auth)
* `brain`: 4 tests (taint propagation, step limit, scanned-PDF OCR where Tesseract exists, unsupported types)

## Known blockers / decisions for you
1. **Push notifications** on iPhone require Hearth installed to the Home Screen, then Settings → Notifications → Enable on this device.
2. Real-hardware verification (Pi, Home Assistant, Ollama, voice) needs your devices.
