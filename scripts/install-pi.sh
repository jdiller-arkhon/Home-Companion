#!/usr/bin/env bash
# One-time setup on Raspberry Pi OS (64-bit, Bookworm). Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  if [ -z "${HEARTH_NONINTERACTIVE:-}" ]; then echo "Docker installed. Log out and back in, then re-run this script."; exit 0; fi
fi

mkdir -p data/web data/backups data/voice data/ollama
if [ ! -f deploy/.env ]; then
  TOKEN=$(openssl rand -hex 32)
  cat > deploy/.env <<ENV
HEARTH_SERVICE_TOKEN=$TOKEN
HEARTH_HOSTNAME=${HEARTH_HOSTNAME:-hearth.local}
TZ=$(cat /etc/timezone 2>/dev/null || echo UTC)
ENV
  chmod 600 deploy/.env
fi

./scripts/fetch-voices.sh data/voice
docker compose -f deploy/docker-compose.yml up -d --build
echo "Pulling the default local model (≈2 GB)…"
docker compose -f deploy/docker-compose.yml exec ollama ollama pull qwen2.5:3b
echo
echo "Hearth is running. On each iPhone/iPad:"
echo "  1. Visit http://$(grep HEARTH_HOSTNAME deploy/.env | cut -d= -f2)/ca.crt and install the profile"
echo "  2. Settings → General → About → Certificate Trust Settings → enable it"
echo "  3. Open https://$(grep HEARTH_HOSTNAME deploy/.env | cut -d= -f2) in Safari → Share → Add to Home Screen"
