#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="$(chezmoi source-path)"
DATA_FILE="$SOURCE_DIR/.chezmoidata/third_party_skills.yaml"
TARGET_BASE="$SOURCE_DIR/dot_agents/skills"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

SKILLS_BIN="${SKILLS_BIN:-$HOME/.local/bin/skills}"

if [ ! -x "$SKILLS_BIN" ]; then
  echo "skills CLI not found at $SKILLS_BIN" >&2
  echo "Install with: npm install -g skills" >&2
  exit 1
fi

if [ ! -f "$DATA_FILE" ]; then
  echo "Data file not found: $DATA_FILE" >&2
  exit 1
fi

# Read all group names into an array
mapfile -t GROUPS < <(yq eval 'keys | .[]' "$DATA_FILE" 2>/dev/null)

for GROUP in "${GROUPS[@]}"; do
  SOURCE=$(yq eval ".\"$GROUP\".source" "$DATA_FILE")
  REF=$(yq eval ".\"$GROUP\".ref" "$DATA_FILE")
  SKILLS_LIST=$(yq eval ".\"$GROUP\".skills[]?" "$DATA_FILE" 2>/dev/null || true)

  if [ "$SOURCE" = "null" ] || [ -z "$SOURCE" ]; then
    echo "Skipping $GROUP: no source defined" >&2
    continue
  fi

  if [ "$REF" = "null" ] || [ -z "$REF" ]; then
    echo "Skipping $GROUP: no ref defined" >&2
    continue
  fi

  echo "--- Vendoring $GROUP ($SOURCE@$REF) ---"

  INSTALL_DIR="$TMP_DIR/$GROUP"
  mkdir -p "$INSTALL_DIR"

  CMD=("$SKILLS_BIN" "add" "${SOURCE}@${REF}" "-a" "opencode" "-y" "--copy")

  if [ -n "$SKILLS_LIST" ]; then
    while IFS= read -r SKILL; do
      [ -n "$SKILL" ] && CMD+=("-s" "$SKILL")
    done <<< "$SKILLS_LIST"
  fi

  (cd "$INSTALL_DIR" && "${CMD[@]}") || {
    echo "Failed to install $GROUP" >&2
    continue
  }

  INSTALLED_DIR="$INSTALL_DIR/.agents/skills"
  if [ ! -d "$INSTALLED_DIR" ]; then
    for TRY in "$INSTALL_DIR/.config/opencode/skills" "$INSTALL_DIR/.claude/skills" "$INSTALL_DIR/.pi/skills"; do
      if [ -d "$TRY" ]; then
        INSTALLED_DIR="$TRY"
        break
      fi
    done
  fi

  if [ ! -d "$INSTALLED_DIR" ]; then
    echo "No skills installed for $GROUP" >&2
    continue
  fi

  for SKILL_DIR in "$INSTALLED_DIR"/*/; do
    SKILL_NAME=$(basename "$SKILL_DIR")
    TARGET_DIR="$TARGET_BASE/$SKILL_NAME"

    rm -rf "$TARGET_DIR"
    mkdir -p "$TARGET_DIR"
    cp -r "$SKILL_DIR"* "$TARGET_DIR/"

    echo "$SOURCE@$REF" > "$TARGET_DIR/dot_vendored-version"

    echo "  Installed: $SKILL_NAME -> $TARGET_DIR"
  done

  echo ""
done

echo "Done. Review changes with: git diff -- dot_agents/skills/"
