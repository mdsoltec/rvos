#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# RetroVault OS — build da imagem de firmware (Raspberry Pi)
#
# Pega um Raspberry Pi OS Lite (64-bit), instala Chromium + cage,
# copia o site + shell + bridge para /opt/retrovault e deixa a
# imagem pronta para gravar no SD: ligou, cai direto na shell.
#
# Uso:
#   sudo ./build-image.sh [--img caminho-do-raspios.img.xz] [--out retrovault-os.img]
#
# Requisitos no host (Debian/Ubuntu):
#   apt install qemu-user-static binfmt-support parted kpartx xz-utils curl
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

RASPIOS_URL="https://downloads.raspberrypi.org/raspios_lite_arm64_latest"
IMG=""
OUT="retrovault-os.img"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(dirname "$HERE")"

while [ $# -gt 0 ]; do
  case "$1" in
    --img) IMG="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    *) echo "opção desconhecida: $1"; exit 1 ;;
  esac
done

[ "$(id -u)" -eq 0 ] || { echo "rode como root (sudo ./build-image.sh)"; exit 1; }

# ── 1. imagem base ──────────────────────────────────────────────────
if [ -z "$IMG" ]; then
  IMG="raspios-lite.img.xz"
  [ -f "$IMG" ] || { echo ">> baixando Raspberry Pi OS Lite arm64…"; curl -fSL "$RASPIOS_URL" -o "$IMG"; }
fi
WORK="work-$$"
mkdir -p "$WORK/mnt/boot" "$WORK/mnt/root"
echo ">> descompactando base…"
xz -dc "$IMG" > "$WORK/base.img"
cp "$WORK/base.img" "$WORK/$OUT"

# ── 2. expande um pouco a raiz (site + chromium + ROMs) ────────────
echo ">> expandindo partição raiz em 1536 MiB…"
truncate -s +1536M "$WORK/$OUT"
LOOP=$(losetup -fP --show "$WORK/$OUT")
trap 'losetup -d "$LOOP" 2>/dev/null || true; umount "$WORK"/mnt/* 2>/dev/null || true' EXIT
parted -s "$LOOP" resizepart 2 100%
e2fsck -fy "${LOOP}p2" >/dev/null || true
resize2fs "${LOOP}p2"

mount "${LOOP}p2" "$WORK/mnt/root"
mount "${LOOP}p1" "$WORK/mnt/boot"

# ── 3. chroot: pacotes + usuário + serviços ────────────────────────
echo ">> preparando chroot (qemu binfmt)…"
if [ "$(uname -m)" != "aarch64" ]; then
  command -v qemu-aarch64-static >/dev/null || { echo "instale qemu-user-static"; exit 1; }
  cp "$(command -v qemu-aarch64-static)" "$WORK/mnt/root/usr/bin/"
fi
mount --bind /dev "$WORK/mnt/root/dev"
mount --bind /dev/pts "$WORK/mnt/root/dev/pts"
mount -t proc proc "$WORK/mnt/root/proc"
mount -t sysfs sys "$WORK/mnt/root/sys"

cat > "$WORK/mnt/root/tmp/customize.sh" <<'EOF'
#!/bin/bash
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
  chromium cage curl network-manager wpasupplicant bluez alsa-utils ca-certificates exfatprogs
systemctl enable bluetooth
systemctl enable NetworkManager
# usuário da shell (sem senha de login — device de appliance)
id rv 2>/dev/null || useradd -m -s /bin/bash rv
usermod -aG input,video,render,audio,tty rv
mkdir -p /opt/retrovault /roms /media/rv
chown -R rv:rv /roms
systemctl enable retrovault-bridge.service retrovault-shell.service
systemctl mask getty@tty1.service
apt-get clean
rm -rf /var/lib/apt/lists/*
EOF
chmod +x "$WORK/mnt/root/tmp/customize.sh"

if [ ! -s "$REPO/webroot/js/catalog.js" ] || [ ! -s "$REPO/webroot/js/fichas.js" ] || [ ! -d "$REPO/webroot/assets" ] || [ ! -d "$REPO/webroot/covers" ] || [ ! -d "$REPO/webroot/cheats" ]; then
  echo ">> dados ausentes: sincronizando com RetroVault WEB…"
  bash "$REPO/tools/sync-from-web.sh"
else
  echo ">> catálogo/assets já presentes; preservando dados deste pacote."
fi
if [ ! -s "$REPO/webroot/vendor/emulatorjs/loader.js" ]; then
  echo ">> baixando EmulatorJS para uso offline…"
  bash "$REPO/tools/fetch-emulatorjs.sh"
fi
[ -s "$REPO/webroot/vendor/emulatorjs/loader.js" ] || { echo "loader do EmulatorJS ausente"; exit 1; }
echo ">> copiando sistema (webroot) + rootfs…"
mkdir -p "$WORK/mnt/root/opt/retrovault/webroot"
cp -rL "$REPO/webroot/." "$WORK/mnt/root/opt/retrovault/webroot/"
cp -r "$HERE/rootfs/." "$WORK/mnt/root/"
ln -sfn /roms "$WORK/mnt/root/opt/retrovault/webroot/roms"
chmod +x "$WORK/mnt/root/opt/retrovault/kiosk.sh" "$WORK/mnt/root/opt/retrovault/bridge.py" "$WORK/mnt/root/opt/retrovault/usb-mount.sh"
chown -R 1000:1000 "$WORK/mnt/root/opt/retrovault" || true

echo ">> executando customize.sh no chroot (baixa pacotes, leva alguns minutos)…"
chroot "$WORK/mnt/root" /tmp/customize.sh
rm -f "$WORK/mnt/root/tmp/customize.sh" "$WORK/mnt/root/usr/bin/qemu-aarch64-static"

# ── 4. boot silencioso e direto ao ponto ───────────────────────────
CMDLINE="$WORK/mnt/boot/cmdline.txt"
if [ -f "$CMDLINE" ]; then
  sed -i 's/$/ quiet loglevel=3 logo.nologo vt.global_cursor_default=0 console=tty3/' "$CMDLINE"
fi
# Sugestões de vídeo/áudio ficam documentadas em HARDWARE.md

# ── 5. finalizar ───────────────────────────────────────────────────
sync
umount "$WORK/mnt/root/dev/pts" "$WORK/mnt/root/dev" "$WORK/mnt/root/proc" "$WORK/mnt/root/sys"
umount "$WORK/mnt/boot" "$WORK/mnt/root"
losetup -d "$LOOP"
trap - EXIT

echo ">> compactando…"
mv "$WORK/$OUT" "./$OUT"
rm -rf "$WORK"
xz -9 -T0 -k "./$OUT" || true

echo
echo "✔ Pronto: $OUT (e $OUT.xz)"
echo "  Gravar no SD:  rpi-imager / balenaEtcher / dd bs=4M if=$OUT of=/dev/sdX"
echo "  Primeiro boot: o console abre direto a shell RetroVault OS."
echo "  ROMs: copie para /roms/<console>/ no SD (ver firmware/README.md)."
