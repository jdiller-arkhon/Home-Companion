# Installing Hearth

## 1. Prepare the Pi
1. Flash **Raspberry Pi OS Lite (64-bit, Bookworm)** with Raspberry Pi Imager. Set the hostname to `hearth`, enable SSH, and add your Wi-Fi (Ethernet is better).
2. Boot from an **NVMe SSD** if you can (see HARDWARE.md); SD cards wear out under database writes.
3. SSH in: `ssh you@hearth.local`

## 2. Install
```bash
git clone <this repo> hearth && cd hearth
```
```bash
./scripts/install-pi.sh
```
The script installs Docker, generates a random service token in `deploy/.env` (mode 600), downloads the voices (~360 MB), starts everything, and pulls the default model `qwen2.5:3b` (~2 GB). On first run it asks you to log out and back in after installing Docker; just re-run it.

Hearth's master encryption key is created at `data/web/secrets/master.key`. **Copy it somewhere safe and offline now** (a USB stick in a drawer or a password manager). Without it, the vault and backups cannot be decrypted.

## 3. Trust the certificate (once per device)
iPhone/iPad only allow home-screen apps and microphone access over HTTPS. Caddy creates a private certificate authority that only your devices trust.

1. On the iPhone, open **Safari** and go to `http://hearth.local/ca.crt`, then tap **Allow** to download the profile.
2. **Settings → General → VPN & Device Management** → tap the downloaded profile → **Install**.
3. **Settings → General → About → Certificate Trust Settings** → turn on full trust for *Caddy Local Authority*.

## 4. Add to Home Screen
1. In Safari open `https://hearth.local`.
2. The first person creates the household; then add your partner in **Settings → People**.
3. Tap **Share → Add to Home Screen**. Hearth now launches full-screen with its own icon.

**iPad kiosk:** Settings → Accessibility → Guided Access → On. Open Hearth and triple-click the top button to lock the iPad to it.

## 5. Connect things (all optional)
* **Weather:** Settings → Household → latitude/longitude (uses Open-Meteo; needs internet).
* **Home Assistant:** in HA, go to Profile → Security → *Long-lived access tokens* → Create. Paste the token and HA's address into Settings → Home Assistant → **Save & test**.
* **GPU computer:** install Ollama there, set `OLLAMA_HOST=0.0.0.0`, run `ollama pull qwen2.5:14b`, then enter `http://that-pc.local:11434` in Settings → Assistant.

## Away from home
Don't port-forward Hearth. Install **Tailscale** on the Pi and your phones (free for personal use), and Hearth is reachable privately from anywhere.

## Updating
```bash
git pull && docker compose -f deploy/docker-compose.yml up -d --build
```
Database migrations run automatically on start. A backup is taken nightly; take one manually from System before big updates.
