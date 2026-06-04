#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="$(chezmoi source-path)"
TARGET_DIR="$HOME/.agents/skills"

mkdir -p "$TARGET_DIR"

if [ -d "$SOURCE_DIR/dot_agents/skills" ]; then
  echo "Installing skills from chezmoi source..."
  cp -r "$SOURCE_DIR/dot_agents/skills/"* "$TARGET_DIR/" 2>/dev/null || true
fi

# Pi's native config dir (~/.pi/agent/skills/) does not read from
# ~/.agents/skills/ — symlink it so pi sees the same skills as opencode.
PI_SKILLS="$HOME/.pi/agent/skills"
if [ -d "$TARGET_DIR" ] && [ ! -e "$PI_SKILLS" ]; then
  mkdir -p "$(dirname "$PI_SKILLS")"
  ln -s "$TARGET_DIR" "$PI_SKILLS"
  echo "Linked pi skills: $PI_SKILLS -> $TARGET_DIR"
fi

echo "Skills installed to $TARGET_DIR"
