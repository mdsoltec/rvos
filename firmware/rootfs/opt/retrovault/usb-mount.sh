#!/bin/sh
# Dispositivo só é invocado pela regra udev para filesystem USB.
set -eu
ACTION="${1:-}"; DEVICE="${2:-}"
case "$DEVICE" in *[!a-zA-Z0-9_-]*|'') exit 1;; esac
DIR="/media/rv/$DEVICE"
if [ "$ACTION" = umount ]; then
  mountpoint -q "$DIR" && umount -l "$DIR" || :
  rmdir "$DIR" 2>/dev/null || :
  exit 0
fi
[ "$ACTION" = mount ] || exit 1
[ -b "/dev/$DEVICE" ] || exit 1
# Não monta uma partição do SD interno nem outro bloco inesperado.
[ "$(udevadm info --query=property --name="/dev/$DEVICE" | grep '^ID_BUS=' || :)" = ID_BUS=usb ] || exit 1
TYPE="$(blkid -s TYPE -o value "/dev/$DEVICE" || :)"
case "$TYPE" in vfat|exfat|ntfs|ntfs3) OPTIONS=nodev,nosuid,noexec,uid=1000,gid=1000,umask=022;;
  ext4|ext3|ext2) OPTIONS=nodev,nosuid,noexec;;
  *) exit 1;; esac
mkdir -p "$DIR"
mount -t "$TYPE" -o "$OPTIONS" "/dev/$DEVICE" "$DIR"
