/**
 * code-intel/index.ts — Pi extension entry point.
 *
 * AST-grep structural search/rewrite tools are COMMENTED OUT while
 * testing pi-lsp-extension's tree-sitter-based code_search/code_rewrite.
 *
 * To restore ast-grep tools instead of pi-lsp-extension's tree-sitter:
 *   1. Uncomment the two pi.registerTool(...) blocks below
 *   2. Restore the imports at the top of this file
 *   3. In .chezmoidata/pi_agent.yaml, replace pi-lsp-extension with pi-lsp
 *
 * ast-grep wrapper + LSP policy modules are kept and compiled so switching
 * back is just uncomment + reinstall.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
// AST-grep tool registration (comment out while testing pi-lsp-extension tree-sitter):
//   import { setup, runAstGrepSearch, runAstGrepReplace } from './ast-grep.js';
//   import { TOOL_ROUTING_GUIDANCE, EXCLUDED_PATHS, getDefaultGlobs } from './lsp-policy.js';
import { mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const LOG_DIR = join(homedir(), '.pi', 'logs');
const LOG = join(LOG_DIR, 'code-intel.log');

try {
  mkdirSync(LOG_DIR, { recursive: true });
} catch { /* directory may already exist */ }

function logToolCall(tool: string, args: Record<string, unknown>, result: Record<string, unknown>): void {
  try {
    const sanitizedArgs: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(args)) {
      sanitizedArgs[k] = typeof v === 'string' && v.length > 80 ? v.slice(0, 80) + '…' : v;
    }
    const matchCount = 'matchCount' in result ? result.matchCount : 'totalMatches' in result ? result.totalMatches : undefined;
    appendFileSync(LOG, JSON.stringify({
      t: new Date().toISOString(),
      tool,
      args: sanitizedArgs,
      success: !('error' in result),
      matchCount,
      error: 'error' in result ? String(result.error).slice(0, 200) : undefined,
    }) + '\n');
  } catch { /* fire-and-forget */ }
}

/**
 * Default export — called by the Pi agent runtime to initialise this extension.
 */
export default function (pi: ExtensionAPI): void {
  // setup(pi);  // re-enable with ast-grep imports above

  /*
   * ────────────────────────────────────────────────────────────────────────
   * AST-GREP TOOLS — COMMENTED OUT for pi-lsp-extension tree-sitter testing
   * ────────────────────────────────────────────────────────────────────────
   *
   * To restore: remove the /* and * / below, and uncomment the imports at top.
   *
   * pi.registerTool('ast_grep_search', {
   *   description:
   *     'Structural, AST-aware code search using ast-grep patterns. ' +
   *     ...
   *   handler: async (args) => { ... },
   * });
   *
   * pi.registerTool('ast_grep_replace', {
   *   description:
   *     'Structural, AST-aware code rewrite using ast-grep. ' +
   *     ...
   *   handler: async (args) => { ... },
   * });
   */
}
