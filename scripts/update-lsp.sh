#!/bin/bash
# Update standalone LSP servers via uv tool install.
# Uses uv tool (isolated env) instead of --system to avoid PEP 668
# externally-managed Python issues.
set -euo pipefail

log() { printf "\033[1;34m[lsp]\033[0m %s\n" "$*"; }

log "Updating pyrefly (>=1,<2)..."
uv tool install --force 'pyrefly>=1,<2' 2>&1

log "Done. pyrefly: $(uv tool list 2>/dev/null | grep pyrefly || echo 'not found')"
