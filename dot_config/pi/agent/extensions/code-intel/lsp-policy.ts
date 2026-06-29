/**
 * lsp-policy.ts — Workflow policy constants and helpers for the code-intel extension.
 *
 * Provides default exclusion globs, tool-routing guidance for the LLM,
 * and language-to-glob mappings used by both ast-grep and LSP tools.
 */

/**
 * Default path exclusion globs.
 * These directories are typically not interesting for code search/rewrite
 * and can significantly slow down ast-grep traversal.
 */
export const EXCLUDED_PATHS: string[] = [
  '**/node_modules/**',
  '**/vendor/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/__pycache__/**',
  '**/target/**',
  '**/.next/**',
];

/**
 * Decision matrix for LLM tool selection.
 * Included in tool descriptions or system context to help the model
 * pick the most efficient tool for a given query.
 */
export const TOOL_ROUTING_GUIDANCE = `
## Code Intelligence Tool Routing

Use the right tool for each task — ordered by preference:

1. **fff** (file-finder-first)
   → Use first for broad file/text discovery, filename search, or simple grep.
   → Fast, low-cost, and sufficient for most "find me X" queries.

2. **lsp_symbols**
   → Use before reading large files when only the structure (classes, functions,
     exports) is needed. Avoids pulling entire file contents into context.

3. **ast_grep_search**
   → Use for structural / AST-aware pattern matching: call sites, imports,
     JSX shapes, function signatures, decorator patterns.
   → Ignores comments, strings, and whitespace differences.
   → Prefer over text grep when code shape matters.

4. **lsp_hover / lsp_definition / lsp_references**
   → Use for semantic questions: "What type is this?", "Where is this defined?",
     "Who calls this function?". Requires an active LSP server.

5. **ast_grep_replace**
   → Use for bulk, structural code rewrites (rename patterns, update API shapes,
     change import styles).
   → **Always preview first** (previewOnly=true, the default).
   → Only apply (previewOnly=false) after reviewing the preview output.

6. **Post-edit validation**
   → After any code modification, rely on LSP diagnostics to confirm the
     change didn't introduce errors.
`.trim();

/**
 * Returns a glob pattern string for common languages.
 * Used as the default `--globs` value when the caller specifies a language
 * but no explicit glob filter.
 *
 * @param language - Optional language identifier (e.g. 'typescript', 'python').
 * @returns A glob string like `'**\/*.{ts,tsx}'`, or empty string if unknown.
 */
export function getDefaultGlobs(language?: string): string | undefined {
  if (!language) return undefined;

  const key = language.toLowerCase().trim();

  /** @type {Record<string, string>} */
  const globs: Record<string, string> = {
    typescript:  '**/*.{ts,tsx}',
    tsx:         '**/*.{ts,tsx}',
    javascript:  '**/*.{js,jsx,mjs,cjs}',
    jsx:         '**/*.{js,jsx,mjs,cjs}',
    python:      '**/*.py',
    go:          '**/*.go',
    rust:        '**/*.rs',
    ruby:        '**/*.rb',
    java:        '**/*.java',
    c:           '**/*.{c,h}',
    cpp:         '**/*.{cpp,cc,cxx,hpp,h}',
    csharp:      '**/*.cs',
    css:         '**/*.css',
    html:        '**/*.{html,htm}',
    kotlin:      '**/*.{kt,kts}',
    swift:       '**/*.swift',
    lua:         '**/*.lua',
  };

  return globs[key] ?? undefined;
}
