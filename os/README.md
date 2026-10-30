# Hearth OS image

Builds a flashable Raspberry Pi image where Hearth *is* the device: flash it to
an SSD/SD card, power on, and the screen goes straight to Hearth's first-run
setup. Underneath it is Raspberry Pi OS Lite (64-bit), locked down and kept
current by Debian security updates — far more reliable than a from-scratch OS.

What the image contains:
* Raspberry Pi OS Lite (Bookworm, arm64), SSH disabled by default
* Docker, the Hearth stack (web, brain, Ollama, Caddy), voices
* The touchscreen kiosk (`scripts/kiosk-setup.sh`)
* A first-boot service that generates fresh secrets and pulls the default model

## Build (on any Linux machine with Docker, ~30–60 min)
```bash
git clone https://github.com/RPi-Distro/pi-gen.git && cd pi-gen && git checkout arm64
```
```bash
cp -r ../hearth/os/stage-hearth . && cp ../hearth/os/config . && echo "HEARTH_SRC=$(realpath ../hearth)" >> config
```
```bash
./build-docker.sh
```
The image appears in `pi-gen/deploy/` as `*-hearth-lite.img.xz`. Flash it with Raspberry Pi Imager
(use the gear icon to set Wi-Fi and your time zone).

Status: the recipe follows pi-gen's documented custom-stage layout but has
**not been built or booted yet** — expect to iterate once on real hardware.
