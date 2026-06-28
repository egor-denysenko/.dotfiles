#!/bin/bash
# Symlink pi's native skills directory to ~/.agents/skills/ so pi can see
# the same skills as opencode. Pi does not read from ~/.agents/skills/
# directly, so this is a one-line bridge.
#
# Idempotent: handles existing directory, broken symlink, and correct
# symlink. If a real directory already exists at the target (e.g. with
# per-skill symlinks from an older setup), it is moved to a timestamped
# backup before being replaced.
set -euo pipefail

SOURCE="$HOME/.agents/skills"
TARGET="$HOME/.pi/agent/skills"

if [ ! -d "$SOURCE" ]; then
    echo "Source $SOURCE does not exist; skipping pi skills symlink" >&2
    exit 0
fi

mkdir -p "$(dirname "$TARGET")"

if [ -L "$TARGET" ]; then
    EXISTING=$(readlink "$TARGET")
    if [ "$EXISTING" = "$SOURCE" ]; then
        echo "Already linked: $TARGET -> $SOURCE"
        exit 0
    fi
    rm "$TARGET"
elif [ -d "$TARGET" ]; then
    BACKUP="${TARGET}.bak.$(date +%s)"
    echo "Backing up $TARGET to $BACKUP"
    mv "$TARGET" "$BACKUP"
fi

ln -s "$SOURCE" "$TARGET"
echo "Linked $TARGET -> $SOURCE"
