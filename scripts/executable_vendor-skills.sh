#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=0
CHECK_LATEST=0
AGENT_HARNESSES=("opencode" "antigravity-cli" "pi")

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --check-latest)
      CHECK_LATEST=1
      shift
      ;;
    -h|--help)
      cat <<USAGE
Usage: $0 [--dry-run] [--check-latest]

Vendors third-party skills listed in .chezmoidata/third_party_skills.yaml
into dot_agents/skills/ using the pnpm dlx \`skills\` CLI.

  --dry-run       Show planned actions without invoking skills CLI.
  --check-latest  Check latest available versions on GitHub for each entry.
                  Updates the YAML file with new pinned refs when updates
                  are found. Combine with --dry-run to preview only.
USAGE
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
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

if [ ! -f "$DATA_FILE" ]; then
  echo "Data file not found: $DATA_FILE" >&2
  exit 1
fi

fetch_latest_ref() {
  local source="$1"
  local owner="${source%%/*}"
  local repo="${source#*/}"
  local resolved=""

  if command -v gh >/dev/null 2>&1 && gh auth status 2>/dev/null >/dev/null; then
    resolved=$(gh api "repos/$owner/$repo/tags" --jq '.[0].name' 2>/dev/null || true)
    if [ -z "$resolved" ]; then
      resolved=$(gh release view --repo "$owner/$repo" --json tagName -q .tagName 2>/dev/null || true)
    fi
    if [ -z "$resolved" ]; then
      resolved=$(gh api "repos/$owner/$repo/commits?per_page=1" --jq '.[0].sha[:12]' 2>/dev/null || true)
    fi
  fi

  if [ -z "$resolved" ] && command -v curl >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
    resolved=$(curl -sfL "https://api.github.com/repos/$owner/$repo/tags" 2>/dev/null | \
      jq -r '.[0].name // empty' 2>/dev/null || true)
    if [ -z "$resolved" ]; then
      resolved=$(curl -sfL "https://api.github.com/repos/$owner/$repo/releases/latest" 2>/dev/null | \
        jq -r '.tag_name // empty' 2>/dev/null || true)
    fi
  fi

  # Fallback to latest commit on default branch (for repos with no tags/releases)
  if [ -z "$resolved" ] && command -v curl >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
    resolved=$(curl -sfL "https://api.github.com/repos/$owner/$repo/commits?per_page=1" 2>/dev/null | \
      jq -r '.[0].sha[:12] // empty' 2>/dev/null || true)
  fi

  if [ -z "$resolved" ]; then
    echo "ERROR" >&2
    return 1
  fi

  echo "$resolved"
}

update_yaml_ref() {
  local group="$1" new_ref="$2"
  awk -v group="$group" -v new_ref="$new_ref" '
    $0 ~ "^  " group ":" { in_group=1 }
    in_group && $0 ~ "^    ref:" {
      sub(/ref: .*/, "ref: " new_ref)
      in_group=0
    }
    { print }
  ' "$DATA_FILE" > "$DATA_FILE.tmp" && mv "$DATA_FILE.tmp" "$DATA_FILE"
}

vendor_group() {
  local group="$1" source="$2" ref="$3"
  shift 3
  local skills=("$@")

  if [ "$CHECK_LATEST" -eq 1 ]; then
    local latest
    if ! latest=$(fetch_latest_ref "$source" 2>/dev/null); then
      printf "  %-25s %-22s → %-22s %s\n" "$group" "$ref" "ERROR" ""
      return 0
    fi

    if [ "$ref" = "$latest" ]; then
      printf "  %-25s %-22s → %-22s %s\n" "$group" "$ref" "$latest" "up-to-date"
    else
      printf "  %-25s %-22s → %-22s %s\n" "$group" "$ref" "$latest" "UPDATE"
      if [ "$DRY_RUN" -eq 0 ]; then
        update_yaml_ref "$group" "$latest"
        echo "    -> pinned $group to $latest"
      fi
    fi
    return 0
  fi

  echo "--- Vendoring $group ($source@$ref) ---"


  local install_dir="$TMP_DIR/$group"
  mkdir -p "$install_dir"

  local cmd=("$SKILLS_BIN" "add" "${source}@${ref}" "-y" "--copy")
  if [ ! -x "$SKILLS_BIN" ]; then
    cmd=("pnpm" "dlx" "skills" "add" "${source}@${ref}" "-y" "--copy")
  fi
  local h
  for h in "${AGENT_HARNESSES[@]}"; do
    cmd+=("-a" "$h")
  done
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

  local installed_dir
  installed_dir=$(find "$install_dir" -type d -name "skills" -print -quit || true)

  if [ -z "$installed_dir" ] || [ ! -d "$installed_dir" ]; then
    echo "  No skills directory found for $group under $install_dir" >&2
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

if [ "$CHECK_LATEST" -eq 1 ]; then
  echo "--- Checking latest versions ---"
else
  echo "--- Vendoring skills ---"
fi

eval "$(chezmoi execute-template <<'EOF'
{{- range $g, $s := .third_party_skills -}}
{{- if and (hasKey $s "source") (hasKey $s "ref") -}}
vendor_group {{ $g | quote }} {{ $s.source | quote }} {{ $s.ref | quote }}
{{- if hasKey $s "skills" }}{{ range $s.skills }} {{ . | quote }}{{ end }}{{ end }}
{{ end -}}
{{- end -}}
EOF
)"

if [ "$CHECK_LATEST" -eq 1 ]; then
  if [ "$DRY_RUN" -eq 1 ]; then
    echo ""
    echo "Dry-run. No files modified."
    echo "Run without --dry-run to pin these versions."
  else
    echo ""
    echo "Updated $DATA_FILE"
    echo "Review changes with: git diff"
  fi
elif [ "$DRY_RUN" -eq 1 ]; then
  echo ""
  echo "Dry run complete. No files changed."
else
  echo ""
  echo "Done. Review changes with: git diff -- dot_agents/skills/"
fi
