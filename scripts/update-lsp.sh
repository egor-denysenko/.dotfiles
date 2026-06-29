#!/bin/bash
# Update standalone LSP servers installed via pip.
# Pins to major version 1 to avoid breaking changes.
set -euo pipefail

log() { printf "\033[1;34m[lsp]\033[0m %s\n" "$*"; }

log "Updating pyrefly (>=1,<2)..."
uv pip install --system 'pyrefly>=1,<2' 2>&1

log "Done. pyrefly: $(command -v pyrefly && pyrefly --version 2>/dev/null || echo 'not found')"
