#!/bin/bash -e
# Copy the Hearth source into the image and install a one-time first-boot setup.
install -d "${ROOTFS_DIR}/opt/hearth"
rsync -a --exclude node_modules --exclude .next --exclude data --exclude .venv --exclude .git "${HEARTH_SRC}/" "${ROOTFS_DIR}/opt/hearth/"

on_chroot <<'CHROOT'
curl -fsSL https://get.docker.com | sh
cat > /etc/systemd/system/hearth-firstboot.service <<'UNIT'
[Unit]
Description=Hearth first boot setup
After=network-online.target docker.service
Wants=network-online.target
ConditionPathExists=!/opt/hearth/.installed

[Service]
Type=oneshot
WorkingDirectory=/opt/hearth
ExecStart=/bin/bash -c 'HEARTH_NONINTERACTIVE=1 ./scripts/install-pi.sh && ./scripts/kiosk-setup.sh && touch /opt/hearth/.installed && reboot'
TimeoutStartSec=3600

[Install]
WantedBy=multi-user.target
UNIT
systemctl enable hearth-firstboot.service
CHROOT
