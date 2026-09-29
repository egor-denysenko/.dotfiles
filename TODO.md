# TODO

Laptop-local tasks that still need doing by hand. Delete each item once it lands.

## Encrypt the LBU archive

`/etc/lbu/lbu.conf` ships with `ENCRYPTION` commented out, so `lbu commit`
writes a **plain, world-readable** gzip to `/media/sda3`. `+etc` is listed in
`/etc/apk/protected_paths.d/lbu.list`, so that archive contains the whole of
`/etc` — including the NetworkManager WiFi PSK in cleartext. `BACKUP_LIMIT=2`
means three copies sit on the disk.

```sh
doas lbu passwd
doas lbu commit -d "encrypt LBU"

# then drop the pre-encryption archives
doas rm /media/sda3/hotel.20260925164754.tar.gz /media/sda3/hotel.20260925170428.tar.gz
```

## Delete the superseded WiFi credentials

NetworkManager owns the connection now (`Xiaomi_1EA9`, `psk-flags=0`, stored
in `/etc/NetworkManager/system-connections/`). NM does **not** encrypt the PSK;
the profile is plain text protected only by `0600 root`. Two leftovers remain,
neither owned by a package, so deleting them is clean:

```sh
doas rm /etc/wpa_supplicant/wpa_supplicant.conf   # old PSK, second plaintext copy
doas rm /etc/network/interfaces                     # inert wlan0 stanza
```

Only do this after a reboot where `nmcli general status` reports `connected`
with no password prompt — the wpa_supplicant file is the rollback path.

Do **not** bother removing `ifupdown-ng-wifi` / `wpa_supplicant-openrc`. They
look like orphans but are `install_if` dependencies of `wpa_supplicant`, which
provides the `nm-wifi-backend` virtual that `networkmanager-wifi` requires, so
apk reinstalls them for as long as NetworkManager is present.

## Repoint signingkey at the new GPG key

A new key was generated on 2026-09-29 and registered with GitHub:
`0E9355D8B92B42D0` ("Porchettos", ed25519, subkey `0A72360F3ABA18B0`).

`dot_gitconfig.tmpl` still names the old `2A132DB1C8C3D189`, which has no
secret key in `~/.gnupg` on this machine, so `commit.gpgsign = true` fails
with `gpg: signing failed: No secret key`. Two things to change:

1. Update `signingkey` in `dot_gitconfig.tmpl` to `0E9355D8B92B42D0`, then
   `chezmoi apply`.
2. Re-sign the commits that landed unsigned in the meantime:

```sh
git resign HEAD~1 HEAD   # in the chezmoi repo; the alias already passes -i
```

Until then, commit with `git commit --no-gpg-sign`.

The new key has a passphrase, so signing needs a TTY (`pinentry` is
`/usr/bin/pinentry`, `pinentry-tty` is not installed). Any commit made from a
non-interactive context — an agent session, CI, a cron job — will hang on the
passphrase prompt rather than fail fast. If that becomes a problem, either
drop the passphrase from the key or install `pinentry-tty`.

## Switch waybar's power module from TLP to power-profiles-daemon

TLP is the power manager and is running (`rc-service tlp status` →
`enabled, last run` at boot), with the Yoga 370 drop-in at
`/etc/tlp.d/10-yoga370.conf` — 70/80 charge thresholds, EPP=power on battery,
1600 MHz cap, i915 capped at 800 MHz. It is doing its job.

`dot_config/waybar/config.jsonc` has `power-profiles-daemon` **disabled** with
a comment pointing here, because the package was never installed and the module
only logged `ServiceUnknown: net.hadess.PowerProfiles` on every bar start.
Waybar itself was never at fault.

To move to PPD (only if the TLP charge thresholds are not wanted):

```sh
doas apk add power-profiles-daemon
doas rc-service power-profiles-daemon start
doas rc-update add power-profiles-daemon default
```

TLP yields EPP / turbo / platform-profile to PPD when it detects it running
(`check_ppd_running()` in `tlp-func-base`), and `bat.d/` has no PPD gates, so
the 70/80 thresholds keep working either way. This Yoga 370 has no ACPI
`/sys/firmware/acpi/platform_profile`, so PPD is EPP-only here.

## Trim the modloop to Intel-only firmware and rebuild it with zstd

This box boots in Alpine **diskless mode**: `/` is a tmpfs, and the kernel
modules plus firmware live in a squashfs "modloop" on `/media/sda2`, mounted
at `/.modloop/modules/$(uname -r)/`. That is the only reason the machine boots,
so treat it with the same care as a bootloader.

The modloop is one 293 MB file holding 1.98 GB of content, and **1.33 GB of
that — 67% — is NVIDIA firmware**. This is a ThinkPad Yoga 370 with an i915
GPU, so none of it can ever load. Since `/lib/firmware` is symlinked from the
modloop at boot, every dead byte is also dead RAM the kernel can never
reclaim. Trimming it is the biggest single win available.

Compression is currently **xz**, not gzip — confirm with `unsquashfs -s`.
zstd is already supported by this kernel (`CONFIG_SQUASHFS_ZSTD=y`) and
decompresses 10-20x faster, which matters because `depmod -A` and every
`modprobe` read through the modloop at boot.

Expect `293 MB → ~85 MB`.

**Do not** touch `modules/6.18.52-0-lts/`. It holds `modules.dep`,
`modules.alias`, and the ten hand-built `xt_*` netfilter modules under
`updates/`. Only prune `modules/firmware/`.

### Steps

Run these in one root shell so the variables survive between steps:

```sh
doas sh
```

```sh
# --- 0. baseline: what am I actually working with? ---
unsquashfs -s /media/sda2/boot/modloop-lts    # superblock: compression, block size, inodes
du -sk /.modloop/modules/firmware              # firmware subtotal (expect ~1456000)
du -sk /.modloop/modules/firmware/nvidia       # the 1332329 kB of dead weight
uname -r                                       # must match the modules/ dir name, or nothing loads
```

```sh
# --- 1. backup: the only rollback path, on a different disk ---
# Keep the original name, on a different physical disk, at depth 2 so that
# find_modloop()'s /media/sda3/* glob never stumbles onto it.
mkdir -p /media/sda3/modloop-backup
cp -a /media/sda2/boot/modloop-lts /media/sda3/modloop-backup/modloop-lts.orig
sha256sum /media/sda2/boot/modloop-lts | tee /media/sda3/modloop-backup/orig.sha256
```

```sh
# --- 2. tools: mksquashfs/unsquashfs are not installed, so none of this is possible yet ---
apk add --no-cache squashfs-tools
```

```sh
# --- 3. extract: vfat is mounted ro, and squashing needs 2 GB of scratch ---
mount -o remount,rw /media/sda2
WORK=/media/sda3/modloop-work
rm -rf "$WORK"; mkdir -p "$WORK"
unsquashfs -d "$WORK" /media/sda2/boot/modloop-lts    # ~1.98 GB, top level is modules/ only
ls -la "$WORK"
```

```sh
# --- 4. build the keep-list from your actual hardware ---
# Sources of truth: /sys/class/drm/card*/device/{vendor,device} -> 0x8086:0x5916
#                   /sys/class/net/*/device/driver           -> e1000e, iwlwifi
#                   modinfo -F firmware <module>              -> the exact files required
FW="$WORK/modules/firmware"
KEEP="$WORK/.keep-list"

{
  echo intel          # btintel (ibt-*), ISH, VPU, AVS
  echo i915           # i915/skl_huc_*, i915/bxt_huc_*
  echo cs42l43.bin.zst
} > "$KEEP"
ls "$FW" | grep -E '^iwlwifi' >> "$KEEP"     # all loose Intel WiFi ucode variants
sort -u -o "$KEEP" "$KEEP"
cat "$KEEP"                                    # confirm before you delete anything
```

```sh
# --- 5. DRY RUN: review exactly what is about to go, largest first ---
# A glob, not find -printf: BusyBox find has no -printf action. 158 top-level entries.
# grep -vxF drops exact whole-line matches only, so keeping "intel" cannot
# accidentally keep "intel-something", and keeping "i915" cannot eat "i915_gem".
for p in "$FW"/*; do basename "$p"; done | grep -vxFf "$KEEP" | while read -r n; do
    du -sk "$FW/$n"
done | sort -rn | head -40
```

Read that list. Only then:

```sh
# --- 6. delete ---
for p in "$FW"/*; do basename "$p"; done | grep -vxFf "$KEEP" | while read -r n; do
    rm -rf "$FW/$n"
done
du -sh "$FW"; ls "$FW"                        # expect ~15 MB, 3-4 entries
```

```sh
# --- 7. assert the kept set is intact ---
# Do NOT loop every module demanding every blob modinfo lists. modinfo reports
# the firmware a driver supports for EVERY chipset, not the installed one:
# iwlwifi alone names 30+ generations and snd_soc_avs names AVS blobs this
# Kaby Lake never asks for. That blanket check reports ~49 false alarms.
#
# Assert the real invariant instead: the set we promised to keep is unchanged.
# These numbers are from the untrimmed tree; if they still match, nothing that
# matters was deleted. iwlwifi-* is 32 files because the keep-list holds every
# generation, so the WiFi count is hardware-independent by construction.
du -ck "$FW"/intel "$FW"/i915 "$FW"/cs42l43* "$FW"/iwlwifi-* | tail -1   # want 19196

# and name the three that are load-bearing for this machine specifically
ls -la "$FW"/intel/ibt-12-16.sfi.zst     # btintel  (Bluetooth)
ls -la "$FW"/i915/skl_huc_2.0.0.bin.zst  # i915     (GPU)
```

```sh
# --- 8. rebuild with zstd ---
# -Xbcj x86        branch/call/jump filter, purpose-built for x86 machine code == .ko files
# -Xdict-size 128K must be >= block size, or zstd rejects the combination
# -b 128K          matches the original; a 1M block means decompressing 1M to read one module
# -noappend        without this, mksquashfs appends to an existing file
# -all-root        sidesteps any uid/gid drift from the extraction
OUT=/media/sda3/modloop-backup/modloop-lts.new
rm -f "$OUT"
mksquashfs "$WORK" "$OUT" \
    -comp zstd -Xcompression-level 17 -Xdict-size 128K -Xbcj x86 \
    -b 128K -noappend -all-root -no-xattrs -no-exports -processors 4
ls -la "$OUT"                                 # expect ~85 MB vs 293 MB
unsquashfs -s "$OUT"                          # confirm compression: zstd
```

```sh
# --- 9. verify before installing ---
# structure, the versioned dir, the module DBs, and your xt_* modules
unsquashfs -l "$OUT" | grep -E 'modules/6\.18\.52-0-lst/(modules\.dep|updates/)' | head
unsquashfs -l "$OUT" | grep -c '\.ko$'         # expect ~3794

# mount it and make depmod rebuild every DB from the new image. A silent exit 0
# means the module tree is self-consistent — this is what catches a botched copy.
# (modprobe is BusyBox here: no -S, no --set-version, no --show-depends, so
#  depmod -b is the portable way to actually exercise the image.)
mkdir -p /tmp/mltest/lib
mount -o loop,ro "$OUT" /tmp/mltest
ln -sf /tmp/mltest/modules /tmp/mltest/lib/modules
depmod -b /tmp/mltest 6.18.52-0-lts             # want: no output, exit 0
grep -m1 'i915\.ko' /tmp/mltest/lib/modules/6.18.52-0-lts/modules.dep
ls /tmp/mltest/lib/modules/6.18.52-0-lts/updates/       # all 10 xt_*.ko must be here
ls /tmp/mltest/lib/modules/firmware/                     # intel i915 iwlwifi-*
umount /tmp/mltest
```

```sh
# --- 10. install ---
# Keep the filename modloop-lts. find_modloop() ignores names and just probes
# every file for a squashfs containing modules/$(uname -r), so a second image
# with a different name makes which one boots non-deterministic.
cp "$OUT" /media/sda2/boot/modloop-lts
sync
reboot
```

### After the reboot

The first boot will print `Failed to verify signature of
/media/sda2/boot/modloop-lts!`. **This is harmless** — `/etc/init.d/modloop`
line 99 only `eerror`s and then mounts anyway. The signature is checked by
basename, and a locally rebuilt image cannot match Alpine's key. To silence it,
add `modloop_verify=no` to the `linux` line in
`/media/sda2/boot/grub/grub.cfg` and the `APPEND` line in
`/media/sda2/boot/syslinux/syslinux.cfg`. Deleting the `.SIGN.RSA.*` file does
not help: it is regenerated from `/media/sda3/hotel.apkovl.tar.gz` every boot.

```sh
uname -r                       # unchanged: 6.18.52-0-lts
findmnt /.modloop              # squashfs mounted
ls /lib/firmware/intel/ /lib/firmware/i915/
lsmod | grep -E 'i915|iwlwifi|e1000e|snd_sof|btintel'
dmesg | grep -iE 'unknown symbol|invalid module|modprobe.*not found'   # want: empty
```

### Rollback

Any black screen or missing driver, from a live environment or the initramfs
shell — this restores the exact image that is booting right now:

```sh
mount -o remount,rw /media/sda2
cp /media/sda3/modloop-backup/modloop-lts.orig /media/sda2/boot/modloop-lts
sync
reboot
```

### Not part of this job

The kernel bump is a **separate** change and should not be combined. Two
blockers: `linux-edge` is not in this repository at all
(`apk search 'linux-*'` returns only `linux-lts`), so the newest available is
`6.18.53-r0` — one patch above the current `6.18.52-0-lts`. And all ten
`updates/xt_*.ko` are stamped `vermagic: 6.18.52-0-lts`; the moment the kernel
version changes they silently stop loading, and there is no dkms and no kernel
source tree in the image to rebuild them from. Locate that source first.

**Also note** the `swappiness = 160` fix from the memory audit is still only in
the running system. It lives in `/etc/sysctl.d/99-memory-tuning.conf`, which is
rebuilt from the apkovl on every boot — so it needs `lbu commit` to stick.
