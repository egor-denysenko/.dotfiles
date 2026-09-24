#!/usr/bin/env bash
# Pick keyboard layout(s) from a list and persist as chezmoi data (`kbd`).
#
#   pick-kbd.sh             interactive: rofi (GUI) -> fzf (TTY) -> printed list
#   pick-kbd.sh --code VAL  non-interactive: validate VAL and write it
#
# Writes `kbd` into ~/.config/chezmoi/chezmoi.toml [data], then runs
# `chezmoi apply` (re-renders config.d/10-input.conf) and `swaymsg reload` so
# the new layout takes effect immediately. Comma-separate multiple layouts
# (e.g. it,us) — sway cycles them when more than one is set.
set -euo pipefail

CFG="${XDG_CONFIG_HOME:-$HOME/.config}/chezmoi/chezmoi.toml"
LST="/usr/share/X11/xkb/rules/evdev.lst"

# "code<TAB>Name" lines for every XKB layout (evdev.lst ships friendly names;
# falls back to bare codes from localectl).
layouts() {
    if [ -r "$LST" ]; then
        awk '/^! layout/{f=1;next} /^! /{f=0} f && NF >= 2 && $1 !~ /^#/ {printf "%s\t%s\n", $1, substr($0, index($0,$2))}' "$LST"
    elif command -v localectl >/dev/null 2>&1; then
        localectl list-x11-keymap-layouts
    fi
}

current() {
    if [ -f "$CFG" ]; then
        sed -n -E 's/^kbd *= *"([^"]*)".*/\1/p' "$CFG" | head -n1
    fi
}

# Prints the raw choice; list/prompt go to stderr so stdout stays clean for capture.
pick() {
    local list cur choice
    list="$(layouts)"
    cur="$(current)"
    [ -n "$list" ] || { echo "no layout list available (xkeyboard-config / localectl missing)" >&2; exit 1; }
    if [ -n "${WAYLAND_DISPLAY:-}${DISPLAY:-}" ] && command -v rofi >/dev/null 2>&1; then
        choice="$(printf '%s\n' "$list" | rofi -dmenu -i -no-custom -multi-select \
            -p "kbd [${cur:-?}] — ctrl+enter picks multiple")" || exit 0
    elif [ -t 0 ] && [ -t 1 ] && command -v fzf >/dev/null 2>&1; then
        choice="$(printf '%s\n' "$list" | fzf --prompt="kbd [${cur:-?}]> ")" || exit 0
    else
        printf '%s\n' "$list" | awk -F'\t' 'NF > 1 {printf "%-10s %s\n", $1, $2}' >&2
        printf 'layout code(s), comma-separated: ' >&2
        IFS= read -r choice || exit 0
    fi
    printf '%s\n' "$choice" | awk 'NF {printf "%s%s", sep, $1; sep=","}'
}

write_kbd() {
    local val="$1"
    [ -f "$CFG" ] || { echo "no chezmoi config at $CFG — run chezmoi init first" >&2; exit 1; }
    if grep -qE '^kbd *= ' "$CFG"; then
        sed -i -E "s|^kbd *= *.*|kbd = \"$val\"|" "$CFG"
    elif grep -qE '^\[data\]' "$CFG"; then
        sed -i "/^\[data\]/a kbd = \"$val\"" "$CFG"
    else
        printf '\n[data]\nkbd = "%s"\n' "$val" >> "$CFG"
    fi
}

if [ "${1:-}" = "--code" ]; then
    val="${2:-}"
    [ -n "$val" ] || { echo "usage: pick-kbd.sh [--code LAYOUT]" >&2; exit 2; }
else
    val="$(pick)" || exit 1
fi
[ -n "$val" ] || exit 0 # cancelled

case "$val" in
    *[!a-z0-9,]*) echo "invalid layout code: $val" >&2; exit 1 ;;
esac

cur="$(current)"
write_kbd "$val"
echo "kbd: ${cur:-unset} -> $val (written to $CFG)"
chezmoi apply
if command -v swaymsg >/dev/null 2>&1 && swaymsg -t get_version >/dev/null 2>&1; then
    swaymsg reload >/dev/null && echo "sway reloaded"
fi
