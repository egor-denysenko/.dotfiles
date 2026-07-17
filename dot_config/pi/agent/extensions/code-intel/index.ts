/**
 * code-intel/index.ts — Pi extension entry point.
 *
 * Registers ast-grep structural search/rewrite tools (ast_grep_search,
 * ast_grep_replace) that complement fff (file/content search) and pi-lsp
 * (LSP diagnostics & code navigation).
 *
 * Tool routing: fff → fast file discovery + grep
 *               ast-grep → structural AST-aware pattern search/rewrite
 *               pi-lsp → LSP hover/definition/references/diagnostics
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { setup, runAstGrepSearch, runAstGrepReplace } from './ast-grep.js';
import { TOOL_ROUTING_GUIDANCE, EXCLUDED_PATHS } from './lsp-policy.js';

/**
 * Default export — called by the Pi agent runtime to initialise this extension.
 */
export default function (pi: ExtensionAPI): void {
  setup(pi);

  pi.registerTool('ast_grep_search', {
    description:
      'Structural, AST-aware code search using ast-grep patterns. ' +
      'Matches code shapes (function signatures, imports, JSX, decorators), not text. ' +
      'Ignores comments, strings, and whitespace. ' +
      'Use for pattern matching where code structure matters. ' +
      'For plain text or filename search, use fff instead.\n\n' +
      TOOL_ROUTING_GUIDANCE,
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'ast-grep pattern (uses standard ast-grep pattern syntax like $VAR, $$ARGS, etc.)',
        },
        language: {
          type: 'string',
          description: 'Language hint (e.g. "typescript", "python", "go", "rust"). Auto-detected from file extension if omitted.',
        },
        path: {
          type: 'string',
          description: 'Directory or file to search (default: current directory).',
          default: '.',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of matches to return (default 50).',
          default: 50,
        },
        globs: {
          type: 'string',
          description: 'File glob filter, e.g. "**/*.{ts,tsx}" to only search TypeScript files.',
        },
      },
      required: ['pattern'],
    },

    handler: async (args: Record<string, unknown>) => {
      const result = await runAstGrepSearch({
        pattern: String(args.pattern ?? ''),
        language: args.language ? String(args.language) : undefined,
        path: args.path ? String(args.path) : '.',
        maxResults: typeof args.maxResults === 'number' ? args.maxResults : 50,
        globs: args.globs ? String(args.globs) : undefined,
        excludedPaths: EXCLUDED_PATHS,
      });

      if ('error' in result) return { error: result.error };
      return {
        matches: result.matches,
        totalMatches: result.totalMatches,
        truncated: result.truncated,
      };
    },
  });

  pi.registerTool('ast_grep_replace', {
    description:
      'Structural, AST-aware code rewrite using ast-grep patterns. ' +
      'Replace code shapes (function signatures, imports, JSX) in-place with preview mode. ' +
      'Use previewOnly=true (default) to see changes before applying.\n\n' +
      TOOL_ROUTING_GUIDANCE,
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'ast-grep pattern to match.',
        },
        rewrite: {
          type: 'string',
          description: 'Replacement pattern (ast-grep rewrite syntax).',
        },
        language: {
          type: 'string',
          description: 'Language hint (e.g. "typescript", "python", "go").',
        },
        path: {
          type: 'string',
          description: 'Directory or file to rewrite (default: current directory).',
          default: '.',
        },
        previewOnly: {
          type: 'boolean',
          description: 'When true (default), only preview changes without modifying files.',
          default: true,
        },
        globs: {
          type: 'string',
          description: 'File glob filter, e.g. "**/*.{ts,tsx}".',
        },
      },
      required: ['pattern', 'rewrite'],
    },

    handler: async (args: Record<string, unknown>) => {
      const result = await runAstGrepReplace({
        pattern: String(args.pattern ?? ''),
        rewrite: String(args.rewrite ?? ''),
        language: args.language ? String(args.language) : undefined,
        path: args.path ? String(args.path) : '.',
        previewOnly: args.previewOnly !== false,
        globs: args.globs ? String(args.globs) : undefined,
        excludedPaths: EXCLUDED_PATHS,
      });

      if ('error' in result) return { error: result.error };
      return {
        success: result.success,
        preview: result.preview,
        output: result.output,
        matchCount: result.matchCount,
      };
    },
  });
}
