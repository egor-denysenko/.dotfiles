#!/bin/sh
set -eu

# Resolve the export-html/index.js path dynamically.
# pnpm global store → <pnpm-global-root>/<hash>/node_modules/...
resolve_file_path() {

  # Try pnpm global install
  if command -v pnpm >/dev/null 2>&1; then
    local pnpm_root
    pnpm_root=$(pnpm root -g 2>/dev/null) || true
    if [ -n "$pnpm_root" ] && [ -d "$pnpm_root" ]; then
      # pnpm v7+ uses hash-named subdirs instead of node_modules
      local found
      found=$(find -L "$pnpm_root" -path "*/@earendil-works/pi-coding-agent/dist/core/export-html/index.js" -print -quit 2>/dev/null) || true
      if [ -n "$found" ] && [ -f "$found" ]; then
        echo "$found"
        return
      fi
    fi
  fi


  return 1
}

FILE_PATH=$(resolve_file_path) || true

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  echo "PI export-html index not found; skipping patch"
  exit 0
fi

FILE_PATH="$FILE_PATH" node - <<'NODE'
const fs = require('fs');

const filePath = process.env.FILE_PATH;
const helperAnchor = 'const TEMPLATE_RENDERED_TOOLS = new Set(["bash", "read", "write", "edit", "ls"]);';
const helperBlock = `const EXPORT_PROMPT_SNAPSHOT_CUSTOM_TYPE = "pi.effective_system_prompt";
function getLatestExportPromptSnapshot(sm) {
    const branchEntries = sm.getBranch();
    for (let i = branchEntries.length - 1; i >= 0; i--) {
        const entry = branchEntries[i];
        if (entry.type !== "custom" || entry.customType !== EXPORT_PROMPT_SNAPSHOT_CUSTOM_TYPE) {
            continue;
        }
        const data = entry.data;
        if (typeof data?.systemPrompt === "string") {
            return {
                systemPrompt: data.systemPrompt,
                tools: Array.isArray(data.tools) ? data.tools : undefined,
            };
        }
    }
    return {};
}`;
const oldExportBlock = `    const sm = SessionManager.open(resolvedInputPath);
    const sessionData = {
        header: sm.getHeader(),
        entries: sm.getEntries(),
        leafId: sm.getLeafId(),
        systemPrompt: undefined,
        tools: undefined,
    };`;
const newExportBlock = `    const sm = SessionManager.open(resolvedInputPath);
    const promptSnapshot = getLatestExportPromptSnapshot(sm);
    const sessionData = {
        header: sm.getHeader(),
        entries: sm.getEntries(),
        leafId: sm.getLeafId(),
        systemPrompt: promptSnapshot.systemPrompt,
        tools: promptSnapshot.tools,
    };`;

let source = fs.readFileSync(filePath, 'utf8');

if (!source.includes('const EXPORT_PROMPT_SNAPSHOT_CUSTOM_TYPE = "pi.effective_system_prompt";')) {
  if (!source.includes(helperAnchor)) {
    throw new Error('Could not find export helper anchor');
  }

  source = source.replace(helperAnchor, `${helperAnchor}\n${helperBlock}`);
}

if (source.includes(oldExportBlock)) {
  source = source.replace(oldExportBlock, newExportBlock);
} else if (!source.includes(newExportBlock)) {
  throw new Error('Could not find offline export block to patch');
}

fs.writeFileSync(filePath, source);
console.log(`Patched ${filePath}`);
NODE
