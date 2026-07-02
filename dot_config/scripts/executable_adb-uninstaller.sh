#!/usr/bin/env bash
set -euo pipefail

# Check requirements
if ! command -v adb &>/dev/null; then
    echo "Error: ADB (Android Debug Bridge) is not installed or not in PATH." >&2
    exit 1
fi

if ! command -v fzf &>/dev/null; then
    echo "Error: fzf is required for interactive selection." >&2
    exit 1
fi

# Get list of connected devices (excluding headers and empty lines)
mapfile -t DEVICES < <(adb devices | sed '1d' | sed '/^ *$/d' | cut -f 1)
DEVICECOUNT=${#DEVICES[@]}

function prompt_yn() {
    read -r -p "$1 [Y/n] " response
    [[ ${response,,} =~ ^(yes|y| ) || -z $response ]] && return 0 || return 1
}

if [[ "$DEVICECOUNT" -eq 0 ]]; then
    echo "No ADB devices connected."
    exit 1
fi

if [[ "$DEVICECOUNT" -gt 1 ]]; then
    SERIAL=$(
        adb devices -l | sed '1d' | sed '/^ *$/d' |
            fzf --reverse --prompt "Select device: " --height=5 |
            cut -f 1 -d ' '
    )
else
    SERIAL="${DEVICES[0]}"
fi

if [[ -z "$SERIAL" ]]; then
    echo "No device selected."
    exit 1
fi

# Query third-party packages
echo "Fetching third-party packages from device ($SERIAL)..."
mapfile -t PACKAGES < <(
    adb -s "$SERIAL" shell pm list packages -3 | cut -d ':' -f 2 | sort |
        fzf --reverse --multi --prompt "Select packages to uninstall (TAB to multi-select): " \
            --preview-window right:40% \
            --preview "echo {} | xargs -I % curl -s -o- \"https://play.google.com/store/apps/details?id=%\" | grep -oh '<title id=\"main-title\">.*</title>' | cut -d '>' -f 2 | cut -d '<' -f 1 | rev | cut -d '-' -f2- | rev || echo 'No preview available'"
)

if [[ ${#PACKAGES[@]} -gt 0 ]]; then
    echo "Selected packages (${#PACKAGES[@]}):"
    printf '  • %s\n' "${PACKAGES[@]}"
    if prompt_yn "Confirm uninstall?"; then
        for package in "${PACKAGES[@]}"; do
            echo -n "Uninstalling $package... "
            if adb -s "$SERIAL" shell pm uninstall "$package" >/dev/null 2>&1; then
                echo "Success"
            else
                echo "Failed."
                if prompt_yn "Try to uninstall as the Android user 0?"; then
                    adb -s "$SERIAL" shell pm uninstall --user 0 "$package"
                fi
            fi
        done
    fi
else
    echo "No packages selected."
fi
