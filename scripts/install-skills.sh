#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="$(chezmoi source-path)"
TARGET_DIR="$HOME/.agents/skills"

# ── Harnesses ────────────────────────────────────────────────
# opencode  → reads ~/.agents/skills/ directly
# pi        → reads ~/.pi/agent/skills/ (symlinked)
# agy       → reads ~/.gemini/skills/   (symlinked — shared by all agy products)
HARNESSES=("opencode" "pi" "agy")

echo ""
echo "Harnesses that will receive skills:"
for h in "${HARNESSES[@]}"; do
  echo "  • $h"
done
echo ""


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

# Agy (antigravity cli) reads ~/.gemini/skills/ as the shared global
# skills dir — symlink so agy, agy cli, and agy ide all see the same skills.
AGY_SKILLS="$HOME/.gemini/skills"
if [ -d "$TARGET_DIR" ] && [ ! -e "$AGY_SKILLS" ]; then
  mkdir -p "$(dirname "$AGY_SKILLS")"
  ln -s "$TARGET_DIR" "$AGY_SKILLS"
  echo "Linked agy skills: $AGY_SKILLS -> $TARGET_DIR"
fi

echo "Skills installed to $TARGET_DIR"
