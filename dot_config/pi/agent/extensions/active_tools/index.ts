import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

const ACTIVE_TOOLS = [
  // built-in — always present
  'read', 'bash', 'edit', 'write',

  // @ff-labs/pi-fff — fast fuzzy file/content search
  'ffgrep', 'fffind',

  // pi-lsp — semantic code intelligence via language server
  'lsp_hover', 'lsp_definition', 'lsp_references', 'lsp_symbols',

  // code-intel — AST structural pattern search (complements text search)
  'ast_grep_search',

  // pi-subagents — delegate/chain/parallel sub-tasks
  'subagent',
];

export default function (pi: ExtensionAPI): void {
  pi.on('session_start', () => {
    const active = pi.getActiveTools();
    const all = pi.getAllTools().map(t => t.name);

    // If --tools or --exclude-tools was passed, the active set will differ
    // from the full registry. In that case respect the user's explicit choice.
    if (active.length !== all.length) return;

    pi.setActiveTools(ACTIVE_TOOLS);
  });
}
