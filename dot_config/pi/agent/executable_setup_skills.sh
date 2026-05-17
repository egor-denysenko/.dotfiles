#!/bin/bash
# Symlinks skills from ~/.agents/skills/ → ~/.config/pi/agent/skills/
# Called by chezmoi run_once_ script at repo root.
# Edit the SKILLS array below to add/remove skills.

set -euo pipefail

PI_SKILLS_DIR="$HOME/.config/pi/agent/skills"
AGENTS_SKILLS_DIR="$HOME/.agents/skills"

mkdir -p "$PI_SKILLS_DIR"

SKILLS=(
  caveman
  caveman-commit
  caveman-review
  compress
  diagnose
  grill-me
  grill-with-docs
  handoff
  improve-codebase-architecture
  plan-first
  prototype
  setup-matt-pocock-skills
  tdd
  to-issues
  to-prd
  triage
  write-a-skill
  zoom-out
)

for skill in "${SKILLS[@]}"; do
  target="$AGENTS_SKILLS_DIR/$skill"
  link="$PI_SKILLS_DIR/$skill"

  if [ ! -e "$target" ]; then
    echo "WARNING: skill source not found: $target" >&2
    continue
  fi

  ln -sf "../../../../.agents/skills/$skill" "$link"
  echo "linked $link → ../../../../.agents/skills/$skill"
done
