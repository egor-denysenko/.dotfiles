/**
 * code-intel/index.ts — Pi extension entry point.
 *
 * Registers two AST-aware code intelligence tools:
 *   • ast_grep_search  — structural pattern search
 *   • ast_grep_replace — structural pattern rewrite (preview + apply)
 *
 * Tools delegate to the ast-grep CLI wrapper in ./ast-grep.ts.
 * Workflow guidance constants live in ./lsp-policy.ts.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { setup, runAstGrepSearch, runAstGrepReplace } from './ast-grep.js';
import { TOOL_ROUTING_GUIDANCE, EXCLUDED_PATHS, getDefaultGlobs } from './lsp-policy.js';
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
  /* Initialise the ast-grep wrapper with the Pi API */
  setup(pi);

  /* ------------------------------------------------------------------
   * Tool: ast_grep_search
   * ------------------------------------------------------------------ */
  pi.registerTool('ast_grep_search', {
    description:
      'Structural, AST-aware code search using ast-grep patterns. ' +
      'Use this instead of text search when you need to match code shapes ' +
      '(call sites, imports, JSX patterns, function signatures) while ignoring ' +
      'comments, strings, and formatting. Prefer fff for simple text/filename ' +
      'discovery first. Pattern examples: `console.log($MSG)`, ' +
      '`import $X from "react"`, `function $NAME($$$PARAMS) { $$$BODY }`.\n\n' +
      TOOL_ROUTING_GUIDANCE,

    parameters: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string',
          description:
            'The ast-grep pattern to search for. Use $NAME for single-node wildcards ' +
            'and $$$NAME for multi-node (variadic) wildcards.',
        },
        language: {
          type: 'string',
          description:
            'Source language hint (e.g. "typescript", "python", "go"). ' +
            'If omitted, ast-grep infers from file extensions.',
        },
        path: {
          type: 'string',
          description: 'File or directory to search. Defaults to current directory.',
          default: '.',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of matches to return. Defaults to 50.',
          default: 50,
        },
        globs: {
          type: 'string',
          description:
            'File glob filter (e.g. "**/*.ts"). If omitted and language is set, ' +
            'a sensible default glob is used.',
        },
      },
      required: ['pattern'],
    },

    /**
     * Handler: run an ast-grep structural search and return matches.
     */
    handler: async (args: {
      pattern: string;
      language?: string;
      path?: string;
      maxResults?: number;
      globs?: string;
    }) => {
      /* Resolve a default glob from the language when none is provided */
      const resolvedGlobs = args.globs ?? getDefaultGlobs(args.language);

      const result = await runAstGrepSearch({
        pattern: args.pattern,
        language: args.language,
        path: args.path ?? '.',
        maxResults: args.maxResults ?? 50,
        globs: resolvedGlobs,
        excludedPaths: EXCLUDED_PATHS,
      });
      logToolCall('ast_grep_search', args, result);
      return result;
    },
  });

  /* ------------------------------------------------------------------
   * Tool: ast_grep_replace
   * ------------------------------------------------------------------ */
  pi.registerTool('ast_grep_replace', {
    description:
      'Structural, AST-aware code rewrite using ast-grep. ' +
      'Safer than manual edit for repeated syntax transformations across files. ' +
      'Always defaults to preview mode — set previewOnly=false only after reviewing ' +
      'the preview output. Use for bulk refactors like renaming call patterns, ' +
      'changing import styles, or updating API call shapes.\n\n' +
      TOOL_ROUTING_GUIDANCE,

    parameters: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string',
          description:
            'The ast-grep pattern to match. Use $NAME for single-node wildcards ' +
            'and $$$NAME for multi-node (variadic) wildcards.',
        },
        rewrite: {
          type: 'string',
          description:
            'The replacement pattern. Reference captured wildcards with $NAME / $$$NAME.',
        },
        language: {
          type: 'string',
          description:
            'Source language hint (e.g. "typescript", "python", "go"). ' +
            'If omitted, ast-grep infers from file extensions.',
        },
        path: {
          type: 'string',
          description: 'File or directory to rewrite in. Defaults to current directory.',
          default: '.',
        },
        previewOnly: {
          type: 'boolean',
          description:
            'If true (default), shows a diff preview without modifying files. ' +
            'Set to false to apply changes in-place.',
          default: true,
        },
        globs: {
          type: 'string',
          description:
            'File glob filter (e.g. "**/*.ts"). If omitted and language is set, ' +
            'a sensible default glob is used.',
        },
      },
      required: ['pattern', 'rewrite'],
    },

    /**
     * Handler: run an ast-grep structural rewrite (preview or apply).
     */
    handler: async (args: {
      pattern: string;
      rewrite: string;
      language?: string;
      path?: string;
      previewOnly?: boolean;
      globs?: string;
    }) => {
      /* Resolve a default glob from the language when none is provided */
      const resolvedGlobs = args.globs ?? getDefaultGlobs(args.language);

      const result = await runAstGrepReplace({
        pattern: args.pattern,
        rewrite: args.rewrite,
        language: args.language,
        path: args.path ?? '.',
        previewOnly: args.previewOnly ?? true,
        globs: resolvedGlobs,
        excludedPaths: EXCLUDED_PATHS,
      });
      logToolCall('ast_grep_replace', args, result);
      return result;
    },
  });
}
