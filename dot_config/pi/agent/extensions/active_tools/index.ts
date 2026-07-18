import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

// ─── Active tool set ───────────────────────────────────────────────────────
// Below is the complete list of tools that will be active. Uncomment or add
// tools to include them. Tools not in this list are pruned on session start.
// To disable pruning entirely, remove or rename this extension.
//
// Core (built-in)
//   read, bash, edit, write
// Fast search (@ff-labs/pi-fff)
//   ffgrep, fffind
// LSP semantic (pi-lsp)
//   lsp_hover, lsp_definition, lsp_references, lsp_symbols
// Structural (code-intel)
//   ast_grep_search
// Delegation (pi-subagents)
//   subagent
// ────────────────────────────────────────────────────────────────────────────

const ACTIVE = new Set([
  'read', 'bash', 'edit', 'write',
  'ffgrep', 'fffind',
  'lsp_hover', 'lsp_definition', 'lsp_references', 'lsp_symbols',
  'ast_grep_search',
  'subagent',
]);

export default function (pi: ExtensionAPI): void {
  pi.on('session_start', (_event: unknown, ctx?: { ui?: { notify: (msg: string, level: string) => void } }) => {
    const all = pi.getAllTools().map(t => t.name);
    const active = pi.getActiveTools();

    // --tools or --exclude-tools was passed. Respect user's explicit choice.
    if (active.length !== all.length) return;

    const pruned = active.filter(t => ACTIVE.has(t));
    const removed = active.filter(t => !ACTIVE.has(t));

    if (removed.length > 0) {
      const msg = `ActiveTools: pruned ${removed.join(', ')}. Add to ACTIVE set in active_tools/index.ts to keep them.`;
      ctx?.ui?.notify(msg, 'warn');
    }

    pi.setActiveTools(pruned);
  });
}
