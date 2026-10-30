# Security, privacy & backups

## Principles
* **Local first.** No cloud AI, no telemetry. The only outbound calls are weather (Open-Meteo, optional) and model/voice downloads at install time.
* **Never publicly exposed.** Only Caddy listens (ports 80/443, LAN). Web, brain and Ollama stay on a private Docker network. `/api/internal/*` is blocked at the proxy as well as token-protected. Use Tailscale for remote access, never port forwarding.
* **Reasoning is separated from execution.** The model proposes; `web/src/server/assistant/tools.ts` validates arguments (zod), computes a permission level and decides.

## Permission levels
| Level | Examples | Behaviour |
|---|---|---|
| read | briefing, list records, weather, search documents | Runs automatically |
| low | add a grocery/task/event, complete a chore, lights, scenes, lock a door | Runs automatically, audited |
| confirm | thermostat outside 60–80°F, closing a garage door, unknown device types | Person taps **Approve** |
| elevated | unlock a door, alarm panel, open garage/gate, delete records | Approve **plus** PIN or password |

**Taint escalation:** once document text (or other untrusted content) has entered a turn, every write in that turn requires at least *confirm*. A malicious PDF saying "unlock the door" can never act silently. Untrusted text is also wrapped in delimiters and scanned for instruction-like phrases. Approvals expire after 15 minutes and can only be approved by the person whose conversation produced them.

The same rules apply in the regular UI: unlocking, opening the garage, deleting financial records or documents, and creating backups all require a PIN or password entered within the last 5 minutes.

## Data protection
* Passwords and PINs: argon2id (OWASP parameters). Login and PIN attempts are rate-limited.
* Sessions: random 256-bit tokens, stored hashed, httpOnly, SameSite=Lax, Secure over HTTPS, 30-day expiry.
* Secrets (Home Assistant token): AES-256-GCM, with keys derived per purpose via HKDF from `master.key`.
* Vault files and extracted text: AES-256-GCM at rest under separate derived keys. Downloads are sent with `Content-Security-Policy: sandbox` and `no-store`.
* Private records and documents are filtered in a single SQL predicate, and the e2e tests verify the other profile can't see them.
* Audit log: every write, approval, denial, login, device command and export, with secrets redacted.

## Tokens (calendar, Siri, sitter links)
* Created only after PIN/password entry; the secret is shown once and stored as a SHA-256 hash.
* Calendar feeds are read-only and include only what that person can see. Siri keys run low-risk commands; anything sensitive is queued for in-app approval. Sitter links show only the emergency card, expire in 1–30 days, and every view is audited.
* Revoke any of them in Settings (or on the Emergency page) — effective immediately.

## Backups
* Automatic: nightly at 3 AM using SQLite's online backup API plus the encrypted vault, keeping 14 (configurable). Stored in `data/backups/`.
* Manual: System → **Back up now** (requires PIN).
* **Off-device copy (recommended):** sync `data/backups/` to a USB drive or NAS, e.g. nightly `rsync -a data/backups/ /mnt/usb/hearth-backups/`. Backups are already encrypted.
* **Keep `data/web/secrets/master.key` separate from the backups.** Both are needed to restore.

### Restore
```bash
docker compose -f deploy/docker-compose.yml stop web
```
```bash
cp data/backups/hearth-<timestamp>/hearth.db data/web/hearth.db && rm -f data/web/hearth.db-wal data/web/hearth.db-shm && rsync -a --delete data/backups/hearth-<timestamp>/vault/ data/web/vault/
```
```bash
docker compose -f deploy/docker-compose.yml start web
```
