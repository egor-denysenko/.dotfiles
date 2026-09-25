#!/bin/sh
# Symlink pi and agy (antigravity) skills directories to ~/.agents/skills/ so all
# harnesses see the same unified skills as opencode.
#
# Idempotent: handles existing directory, broken symlink, and correct
# symlink. Real directories at target are backed up before replacement.
set -eu

SOURCE="$HOME/.agents/skills"

if [ ! -d "$SOURCE" ]; then
    echo "Source $SOURCE does not exist; skipping skills symlink" >&2
    exit 0
fi

link_skills() {
    target="$1"
    mkdir -p "$(dirname "$target")"

    if [ -L "$target" ]; then
        existing=$(readlink "$target")
        if [ "$existing" = "$SOURCE" ]; then
            echo "Already linked: $target -> $SOURCE"
            return 0
        fi
        rm "$target"
    elif [ -d "$target" ]; then
        backup="${target}.bak.$(date +%s)"
        echo "Backing up $target to $backup"
        mv "$target" "$backup"
    fi

    ln -s "$SOURCE" "$target"
    echo "Linked $target -> $SOURCE"
}

link_skills "$HOME/.pi/agent/skills"
link_skills "$HOME/.gemini/skills"
