#!/usr/bin/env bash
# Turns a Raspberry Pi with a touchscreen (official Touch Display 2 or any HDMI
# touch monitor) into a dedicated Hearth device: boots straight into Hearth,
# full-screen, no desktop, no browser chrome, auto-restarts on crash.
# Run after scripts/install-pi.sh. Safe to re-run.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || exec sudo -E "$0" "$@"

KIOSK_USER=hearth-kiosk
URL="${HEARTH_KIOSK_URL:-http://localhost:3000/}"

apt-get update -qq
# cage: a minimal Wayland compositor that runs exactly one app full-screen.
apt-get install -y -qq cage chromium-browser seatd >/dev/null 2>&1 || apt-get install -y -qq cage chromium seatd >/dev/null

id "$KIOSK_USER" >/dev/null 2>&1 || useradd -m -G video,render,input,audio "$KIOSK_USER"
BROWSER=$(command -v chromium-browser || command -v chromium)

cat > /etc/systemd/system/hearth-kiosk.service <<UNIT
[Unit]
Description=Hearth touchscreen
After=docker.service network-online.target seatd.service
Wants=network-online.target seatd.service

[Service]
User=$KIOSK_USER
PAMName=login
TTYPath=/dev/tty1
Environment=XDG_RUNTIME_DIR=/run/user/%U
ExecStartPre=/bin/sh -c 'for i in \$(seq 1 90); do curl -fs $URL/login >/dev/null && exit 0; sleep 2; done; exit 0'
ExecStart=/usr/bin/cage -d -- $BROWSER --kiosk --noerrdialogs --disable-infobars --no-first-run --disable-session-crashed-bubble \\
  --disable-features=Translate,TouchpadOverscrollHistoryNavigation --overscroll-history-navigation=0 --check-for-update-interval=31536000 \\
  --autoplay-policy=no-user-gesture-required --app=$URL
Restart=always
RestartSec=3

[Install]
WantedBy=graphical.target
UNIT

# No console on the screen, no blanking (Hearth's display mode dims itself).
systemctl disable getty@tty1.service >/dev/null 2>&1 || true
grep -q consoleblank /boot/firmware/cmdline.txt 2>/dev/null || sed -i 's/$/ consoleblank=0 quiet loglevel=3 logo.nologo vt.global_cursor_default=0/' /boot/firmware/cmdline.txt 2>/dev/null || true
systemctl enable --now seatd >/dev/null
systemctl set-default graphical.target >/dev/null
systemctl daemon-reload
systemctl enable hearth-kiosk.service
echo "Done. Reboot to start the Hearth screen: sudo reboot"
echo "Tip: sign in once on the screen, then open Display mode from the sidebar to make it the always-on view."
