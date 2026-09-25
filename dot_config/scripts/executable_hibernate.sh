#!/bin/sh
# Lock screen and hibernate the machine across systemd and OpenRC (Alpine, etc.)
set -e

# Lock the screen first if a locker is available
if command -v swaylock >/dev/null 2>&1; then
    swaylock -f -c 000000 &
    sleep 0.5
fi

# 1. systemd
if command -v systemctl >/dev/null 2>&1 && systemctl hibernate 2>/dev/null; then
    exit 0
fi

# 2. elogind / logind
if command -v loginctl >/dev/null 2>&1 && loginctl hibernate 2>/dev/null; then
    exit 0
fi

# 3. Alpine / OpenRC zzz (ZZZ hibernates to disk, zzz -Z also works)
if command -v ZZZ >/dev/null 2>&1; then
    ZZZ && exit 0
fi

if command -v zzz >/dev/null 2>&1; then
    zzz -Z && exit 0
fi

# 4. doas / sudo zzz fallback
if command -v doas >/dev/null 2>&1 && doas -n ZZZ 2>/dev/null; then
    exit 0
fi

if command -v sudo >/dev/null 2>&1 && sudo -n ZZZ 2>/dev/null; then
    exit 0
fi

# 5. pm-utils
if command -v pm-hibernate >/dev/null 2>&1; then
    pm-hibernate && exit 0
fi

# 6. Direct sysfs fallback (works if user has write permissions to /sys/power/state)
if [ -w /sys/power/state ] && echo disk > /sys/power/state 2>/dev/null; then
    exit 0
fi

# If we reached here, hibernation failed or was not supported
msg="Hibernation failed: neither systemctl, loginctl, ZZZ, nor pm-hibernate succeeded. Ensure swap and kernel resume support are configured."
if command -v notify-send >/dev/null 2>&1; then
    notify-send -u critical "Hibernation Error" "$msg"
fi
echo "$msg" >&2
exit 1
