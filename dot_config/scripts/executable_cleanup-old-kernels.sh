#!/usr/bin/env bash
set -euo pipefail

# Find old kernels (dnf repoquery works without root)
old_kernels=($(dnf repoquery --installonly --latest-limit=-1 -q 2>/dev/null || true))
if [ "${#old_kernels[@]}" -eq 0 ]; then
    echo "No old kernels found"
    exit 0
fi

echo "Found old kernels to remove: ${old_kernels[*]}"

# Run dnf remove with sudo if not root
if [ "$EUID" -ne 0 ]; then
    if command -v sudo &>/dev/null; then
        echo "Requesting root privileges to remove old kernels..."
        exec sudo dnf remove "${old_kernels[@]}"
    else
        echo "Error: This script must be run as root or with sudo available." >&2
        exit 1
    fi
else
    exec dnf remove "${old_kernels[@]}"
fi
