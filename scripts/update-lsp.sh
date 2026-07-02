#!/usr/bin/env bash
# Update standalone LSP servers.
set -euo pipefail

log() { printf "\033[1;34m[lsp]\033[0m %s\n" "$*"; }

# Python-based LSPs (installed via uv tool for isolated environments)
log "Updating pyrefly (>=1,<2)..."
uv tool install --force 'pyrefly>=1,<2' 2>&1

log "Done. pyrefly: $(uv tool list 2>/dev/null | grep pyrefly || echo 'not found')"
