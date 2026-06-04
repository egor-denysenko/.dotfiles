#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      cat <<USAGE
Usage: $0 [--dry-run]

Vendors third-party skills listed in .chezmoidata/third_party_skills.yaml
into dot_agents/skills/ using the npx \`skills\` CLI.

  --dry-run   Parse YAML and print the planned actions; do not invoke
              the skills CLI or write anything to dot_agents/skills/.
USAGE
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

if ! command -v chezmoi >/dev/null 2>&1; then
  echo "chezmoi not found in PATH" >&2
  exit 1
fi

SOURCE_DIR="$(chezmoi source-path)"
DATA_FILE="$SOURCE_DIR/.chezmoidata/third_party_skills.yaml"
TARGET_BASE="$SOURCE_DIR/dot_agents/skills/vendored"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

SKILLS_BIN="${SKILLS_BIN:-$HOME/.local/bin/skills}"

if [ ! -x "$SKILLS_BIN" ] && [ "$DRY_RUN" -eq 0 ]; then
  echo "skills CLI not found at $SKILLS_BIN" >&2
  echo "Install with: npm install -g skills" >&2
  exit 1
fi

if [ ! -f "$DATA_FILE" ]; then
  echo "Data file not found: $DATA_FILE" >&2
  exit 1
fi

vendor_group() {
  local group="$1" source="$2" ref="$3"
  shift 3
  local skills=("$@")

  echo "--- Vendoring $group ($source@$ref) ---"

  local install_dir="$TMP_DIR/$group"
  mkdir -p "$install_dir"

  local cmd=("$SKILLS_BIN" "add" "${source}@${ref}" "-a" "opencode" "-y" "--copy")
  local s
  for s in "${skills[@]}"; do
    cmd+=("-s" "$s")
  done

  if [ "$DRY_RUN" -eq 1 ]; then
    echo "  [dry-run] Would run: ${cmd[*]}"
    if [ "${#skills[@]}" -gt 0 ]; then
      for s in "${skills[@]}"; do
        echo "  [dry-run] Would install: $s -> $TARGET_BASE/$s"
      done
    else
      echo "  [dry-run] Would install all discoverable skills from $source"
    fi
    echo ""
    return 0
  fi

  (cd "$install_dir" && GIT_TERMINAL_PROMPT=0 "${cmd[@]}") || {
    echo "  Failed to install $group" >&2
    return 1
  }

  local installed_dir="$install_dir/.agents/skills"
  if [ ! -d "$installed_dir" ]; then
    local try
    for try in "$install_dir/.config/opencode/skills" "$install_dir/.claude/skills" "$install_dir/.pi/skills"; do
      if [ -d "$try" ]; then
        installed_dir="$try"
        break
      fi
    done
  fi

  if [ ! -d "$installed_dir" ]; then
    echo "  No skills installed for $group" >&2
    return 1
  fi

  local skill_dir skill_name target_dir
  for skill_dir in "$installed_dir"/*/; do
    [ -d "$skill_dir" ] || continue
    skill_name=$(basename "$skill_dir")
    target_dir="$TARGET_BASE/$skill_name"

    rm -rf "$target_dir"
    mkdir -p "$target_dir"
    cp -r "$skill_dir". "$target_dir/"
    rm -f "$target_dir/README.md"
    echo "$source@$ref" > "$target_dir/dot_vendored-version"
    echo "  Installed: $skill_name -> $target_dir"
  done

  echo ""
}

eval "$(chezmoi execute-template <<'EOF'
{{- range $g, $s := .third_party_skills -}}
{{- if and (hasKey $s "source") (hasKey $s "ref") -}}
vendor_group {{ $g | quote }} {{ $s.source | quote }} {{ $s.ref | quote }}
{{- if hasKey $s "skills" }}{{ range $s.skills }} {{ . | quote }}{{ end }}{{ end }}
{{ end -}}
{{- end -}}
EOF
)"

if [ "$DRY_RUN" -eq 1 ]; then
  echo "Dry run complete. No files changed."
else
  echo "Done. Review changes with: git diff -- dot_agents/skills/"
fi
