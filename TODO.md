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

## Import the GPG signing key

`gnupg` is installed but `~/.gnupg` is empty, and `dot_gitconfig.tmpl` sets
`commit.gpgsign = true` when `machine = "personal"`. Every `git commit`
therefore fails with `error: cannot run gpg`. Import the secret key for
`2A132DB1C8C3D189`, then re-sign the commits made before the key existed:

```sh
git resign HEAD~1 HEAD   # in the chezmoi repo; the alias already passes -i
```
