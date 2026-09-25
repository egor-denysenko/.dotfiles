#!/bin/sh
# Launches preferred terminal: wezterm -> ghostty -> foot
for term in wezterm ghostty foot; do
    if command -v "$term" >/dev/null 2>&1; then
        exec "$term" "$@"
    fi
done

if command -v notify-send >/dev/null 2>&1; then
    notify-send -u critical "Terminal Error" "No terminal found (tried: wezterm, ghostty, foot)"
fi
echo "No supported terminal found (tried: wezterm, ghostty, foot)" >&2
exit 1
