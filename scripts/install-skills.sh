#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="$(chezmoi source-path)"
TARGET_DIR="$HOME/.agents/skills"

mkdir -p "$TARGET_DIR"

# Copy personal skills first
if [ -d "$SOURCE_DIR/dot_agents/personal_skills" ]; then
  echo "Installing personal skills..."
  cp -r "$SOURCE_DIR/dot_agents/personal_skills/"* "$TARGET_DIR/" 2>/dev/null || true
fi

# Copy external skills (overwrites personal if conflict)
if [ -d "$SOURCE_DIR/dot_agents/external_skills" ]; then
  echo "Installing external skills..."
  cp -r "$SOURCE_DIR/dot_agents/external_skills/"* "$TARGET_DIR/" 2>/dev/null || true
fi

echo "Skills installed to $TARGET_DIR"
