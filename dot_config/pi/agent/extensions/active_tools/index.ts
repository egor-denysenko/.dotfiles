import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

const ACTIVE_TOOLS = [
  'read', 'bash', 'edit', 'write',
  'ffgrep', 'fffind',
  'lsp_hover', 'lsp_definition', 'lsp_references', 'lsp_symbols',
  'ast_grep_search',
  'subagent',
];

export default function (pi: ExtensionAPI): void {
  pi.on('session_start', () => {
    pi.setActiveTools(ACTIVE_TOOLS);
  });
}
