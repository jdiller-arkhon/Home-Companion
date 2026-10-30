# Hearth

A private household companion for two people. It runs on a Raspberry Pi 5 on your home network and installs on iPad and iPhone as a home-screen app. Everything stays on your own hardware: the assistant uses local models only.

| | |
|---|---|
| **Today** | Greeting, grounded daily briefing, weather, agenda, bills, home status, packages |
| **Assistant** | Local LLM (Ollama) with tool calling, streaming, memory, voice in and out (Whisper + Piper), approval cards for sensitive actions |
| **Home** | Home Assistant devices by room: lights, switches, locks, thermostats, covers, sensors, scenes |
| **Planner** | Shared and private calendar, tasks, errands, groceries, meals, recipes, chores, occasions, notes, goals |
| **Finance** | Bills, subscriptions, spending, budgets, savings goals, 6-month trend. **It never moves money.** |
| **Upkeep** | Maintenance schedule, appliances and warranties, vehicles, repair history, supplies |
| **Vault** | AES-256-GCM encrypted documents, text search, OCR, expiry dates, per-document sharing |
| **Packages** | Manual shipment tracking with status and expected dates |
| **System** | Pi temperature, CPU, RAM, storage, services, AI models, backups, audit log, errors |

## Architecture

```
iPad / iPhone (PWA) ──HTTPS──► Caddy (local CA) ──► web  (Next.js · SQLite · policy gate)
                                                      │  ▲ tool requests (service token)
                                                      ▼  │
                                                     brain (FastAPI) ──► Ollama (Pi or GPU PC)
                                                      │                   Whisper · Piper
                                                      └──► Home Assistant (your LAN)
```

* **web/**: Next.js 16 + React 19 + Tailwind 4, Radix primitives. Owns identity, data, the permission policy and the audit log. SQLite (WAL) is used deliberately: it is a single node with two users, needs zero ops, backs up as one consistent file, and saves about 300 MB of RAM over PostgreSQL on the Pi.
* **brain/**: Python FastAPI. Builds prompts, runs the model's reason→tool loop, and does speech and OCR. It holds **no** device or data credentials; it can only *ask* web to run a tool.
* **Ollama**: the local model server. Point Settings → Assistant at a GPU computer for faster, larger models; Hearth falls back to the Pi when that computer is off.

## Quick start (Raspberry Pi)

```bash
git clone <this repo> hearth && cd hearth
```

```bash
./scripts/install-pi.sh
```

Then follow **[docs/INSTALL.md](docs/INSTALL.md)** to trust the certificate and add Hearth to your iPhone and iPad home screens.

## Development

```bash
cd web && npm install && npm run dev
```

```bash
cd brain && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]" && HEARTH_SERVICE_TOKEN=dev .venv/bin/uvicorn brain.main:app --port 8100
```

Tests: `cd web && npm test` (unit) · `npm run build && npx playwright test` (browser) · `cd brain && .venv/bin/pytest`.

Docs: [Install](docs/INSTALL.md) · [Security & backups](docs/SECURITY.md) · [Hardware](docs/HARDWARE.md) · [Voice](docs/VOICE.md) · [Status](docs/STATUS.md)
