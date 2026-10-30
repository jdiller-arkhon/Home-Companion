# Hardware checklist

## Required
| Item | Why | ≈ USD |
|---|---|---|
| Raspberry Pi 5, **8 GB** | Runs everything incl. a 3B model | 80 |
| Official 27 W USB-C power supply | Under-voltage causes throttling and corruption | 12 |
| Active cooler (official) | Sustained AI inference heats the SoC | 5 |
| NVMe SSD 256 GB + M.2 HAT+ (or a case with M.2) | Durable storage for the database, models and backups | 50 |
| Case with airflow (e.g. Argon NEO 5 M.2 / Pimoroni NVMe Base) | | 25 |
| Ethernet cable to your router | Stable LAN for the iPad and Home Assistant | 5 |

## Interfaces
* iPad (any model from the last ~5 years running iPadOS 17+) and a stand for the kitchen/hall.
* iPhones running iOS 17+.

## Optional
| Item | Use |
|---|---|
| USB drive 128 GB+ | Off-device backup copies |
| GPU PC (8 GB+ VRAM) running Ollama | 14B-class models with 5–10× faster replies; Hearth uses it when on |
| Home Assistant host (Home Assistant Green ≈ $99, or a second Pi) | Recommended to keep HA separate from Hearth |
| Zigbee coordinator: SONOFF ZBDongle-E or Home Assistant Connect ZBT-1 | Zigbee sensors, bulbs, locks via HA |
| Thread border router | Matter-over-Thread devices via HA |
| UPS / power bank with pass-through | Survive brief outages cleanly |

## Feasibility on the Pi 5 (8 GB)
Measured budget (approximate, steady state): web ~150 MB, brain ~250 MB plus Whisper base.en ~300 MB, Ollama with `qwen2.5:3b` Q4 ~2.5 GB, Caddy ~30 MB, OS ~400 MB. That totals about 3.7 GB, leaving headroom. Expect roughly 6–10 tokens/s from a 3B model on the Pi 5: fine for short household replies, and slow for long document summaries (use the GPU computer for those). Avoid 7B+ models on the Pi alongside everything else.
