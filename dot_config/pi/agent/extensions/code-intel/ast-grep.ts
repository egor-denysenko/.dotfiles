/**
 * ast-grep.ts — CLI wrapper for ast-grep structural search and rewrite.
 *
 * Provides two public functions:
 *   - runAstGrepSearch  — AST-aware pattern search (JSON stream output)
 *   - runAstGrepReplace — AST-aware rewrite with preview/apply modes
 *
 * Both functions never throw; they return `{ error: string }` on failure.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

/* ------------------------------------------------------------------ */
/*  Module-level reference to the Pi extension API                     */
/* ------------------------------------------------------------------ */

let _pi: ExtensionAPI;

/**
 * Initialise the module with the Pi extension API instance.
 * Must be called once from index.ts before any search/replace calls.
 */
export function setup(pi: ExtensionAPI): void {
  _pi = pi;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** A single search match, trimmed for LLM-friendly output. */
interface MatchResult {
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  snippet: string;
}

/** Shape returned by `runAstGrepSearch`. */
interface SearchResult {
  matches: MatchResult[];
  totalMatches: number;
  truncated: boolean;
}

/** Shape returned by `runAstGrepReplace`. */
interface ReplaceResult {
  success: boolean;
  preview: boolean;
  output: string;
  matchCount: number;
}

/** Shape returned on any error. */
interface ErrorResult {
  error: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Maximum characters of raw output before we truncate. */
const MAX_OUTPUT_CHARS = 8_000;

/**
 * Known warning lines on stderr that should be filtered out
 * before checking for error signals.
 */
const KNOWN_WARNING_LINES = [
  'postinstall script did not run; falling back to runtime binary resolution.',
  'Enable postinstall to avoid the per-invocation overhead.',
];

/**
 * Filter known warning lines from stderr to avoid false positives
 * in error detection and to reduce noise in output.
 */
function filterStderr(stderr: string): string {
  const lines = stderr.split('\n');
  return lines
    .filter((line) => !KNOWN_WARNING_LINES.some((warn) => line.includes(warn)))
    .join('\n')
    .trim();
}

/**
 * Truncate a string to `max` characters, appending a notice if trimmed.
 */
function truncate(text: string, max: number = MAX_OUTPUT_CHARS): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '\n\n… [output truncated — showing first ' + max + ' chars]';
}

/**
 * Check whether an exec failure indicates the binary was not found.
 *
 * The reliable POSIX signal for a missing command is exit code 127.
 * `ENOENT` can also appear when the OS cannot find the binary.
 * Broader strings like "not found" or "No such file" can match
 * legitimate ast-grep error messages about missing search paths,
 * so they are intentionally excluded here.
 */
function isBinaryNotFound(code: number | null, stderr: string): boolean {
  return code === 127 || stderr.includes('ENOENT');
}

/**
 * Determine whether ast-grep exited with "no matches" rather than a real error.
 *
 * ast-grep returns exit code 1 with empty stdout when no matches are found.
 * Real errors use exit code >= 2 or include "ERROR"/"error:" on stderr
 * (after filtering known warnings).
 *
 * @param code   - The exit code from the exec call.
 * @param stdout - The stdout content.
 * @param stderr - The raw stderr content (before filtering).
 * @returns `true` if the exit is a legitimate no-match result.
 */
function isNoMatch(code: number | null, stdout: string | null | undefined, stderr: string): boolean {
  if (code !== 1) return false;
  if ((stdout ?? '').trim().length > 0) return false;
  // After filtering known warnings, check for real error indicators
  const clean = filterStderr(stderr);
  if (clean.length === 0) return true; // warnings only → no match
  // Real errors contain ERROR / error: / Error: on stderr
  if (/error:/i.test(clean)) return false;
  if (/^ERROR/.test(clean)) return false;
  // If stderr has content but no error indicators, it's likely a warning → no match
  return true;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Run an AST-aware structural search via `ast-grep run --json=stream`.
 *
 * @param args.pattern    - The ast-grep pattern to match (required).
 * @param args.language   - Optional language hint (e.g. 'typescript').
 * @param args.path       - Directory or file to search (default '.').
 * @param args.maxResults - Cap on returned matches (default 50).
 * @param args.globs      - Optional file glob filter (e.g. '**\/*.ts').
 * @returns Search results or an error object.
 */
export async function runAstGrepSearch(args: {
  pattern: string;
  language?: string;
  path?: string;
  maxResults?: number;
  globs?: string;
  excludedPaths?: string[];
}): Promise<SearchResult | ErrorResult> {
  const { pattern, language, path = '.', maxResults = 50, globs, excludedPaths } = args;

  /* --- Build CLI arguments --- */
  const cliArgs: string[] = ['run', '--pattern', pattern, '--json=stream', '-C', '2'];

  if (language) {
    cliArgs.push('--lang', language);
  }
  if (globs) {
    cliArgs.push('--globs', globs);
  }
  if (excludedPaths && excludedPaths.length > 0) {
    for (const ep of excludedPaths) {
      cliArgs.push('--globs', `!${ep}`);
    }
  }
  cliArgs.push(path);

  /* --- Execute --- */
  try {
    const result = await _pi.exec('ast-grep', cliArgs, { timeout: 30_000 });

    /* Binary not found */
    if (isBinaryNotFound(result.code, result.stderr ?? '')) {
      return {
        error:
          'ast-grep binary not found. Ensure ast-grep v0.44+ is installed and on PATH. ' +
          'Install via: npm i -g @ast-grep/cli  or  cargo install ast-grep',
      };
    }

    /* No matches — exit code 1 with empty stdout and no real error on stderr */
    if (isNoMatch(result.code, result.stdout, result.stderr ?? '')) {
      return { matches: [], totalMatches: 0, truncated: false };
    }

    /* Real error (exit code >= 2 or stderr contains ERROR) */
    if (result.code !== 0) {
      const cleanStderr = filterStderr(result.stderr ?? '');
      return {
        error: `ast-grep exited with code ${result.code}: ${cleanStderr || 'unknown error'}`,
      };
    }

    /* --- Parse JSON-stream output --- */
    const lines = (result.stdout ?? '')
      .split('\n')
      .filter((l: string) => l.trim().length > 0);

    const allMatches: MatchResult[] = [];

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        allMatches.push({
          file: entry.file ?? entry.path ?? '<unknown>',
          line: (entry.range?.start?.line ?? 0) + 1,
          column: (entry.range?.start?.column ?? 0) + 1,
          endLine: (entry.range?.end?.line ?? 0) + 1,
          endColumn: (entry.range?.end?.column ?? 0) + 1,
          snippet: entry.lines ?? entry.text ?? '',
        });
      } catch {
        /* skip malformed JSON lines (e.g. progress indicators) */
      }
    }

    const totalMatches = allMatches.length;
    const truncated = totalMatches > maxResults;
    const matches = truncated ? allMatches.slice(0, maxResults) : allMatches;

    return { matches, totalMatches, truncated };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `ast-grep search failed: ${msg}` };
  }
}

/**
 * Run an AST-aware structural rewrite via `ast-grep run --rewrite`.
 *
 * By default operates in **preview mode** (no files modified).
 * Set `previewOnly: false` to apply changes in-place (`-U` / `--update-all`).
 *
 * @param args.pattern     - The ast-grep pattern to match (required).
 * @param args.rewrite     - The replacement pattern (required).
 * @param args.language    - Optional language hint.
 * @param args.path        - Directory or file (default '.').
 * @param args.previewOnly - If true (default), only preview changes.
 * @param args.globs       - Optional file glob filter.
 * @returns Rewrite result or an error object.
 */
export async function runAstGrepReplace(args: {
  pattern: string;
  rewrite: string;
  language?: string;
  path?: string;
  previewOnly?: boolean;
  globs?: string;
  excludedPaths?: string[];
}): Promise<ReplaceResult | ErrorResult> {
  const {
    pattern,
    rewrite,
    language,
    path = '.',
    previewOnly = true,
    globs,
    excludedPaths,
  } = args;

  /* --- Build CLI arguments --- */
  const cliArgs: string[] = ['run', '--pattern', pattern, '--rewrite', rewrite];

  if (language) {
    cliArgs.push('--lang', language);
  }
  if (globs) {
    cliArgs.push('--globs', globs);
  }
  if (excludedPaths && excludedPaths.length > 0) {
    for (const ep of excludedPaths) {
      cliArgs.push('--globs', `!${ep}`);
    }
  }

  /*
   * Preview mode: add --json=stream so we can reliably count matches
   * from parsed JSON objects. The JSON output includes a "replacement"
   * field for each matched node.
   *
   * Apply mode (-U): stdout is empty; stderr contains "Applied N changes".
   * Do NOT add --json=stream in apply mode because -U does not produce
   * JSON-stream output.
   */
  if (previewOnly) {
    cliArgs.push('--json=stream');
  } else {
    cliArgs.push('-U'); // --update-all: apply changes in-place
  }
  cliArgs.push(path);

  /* --- Execute --- */
  try {
    const result = await _pi.exec('ast-grep', cliArgs, { timeout: 30_000 });

    /* Binary not found */
    if (isBinaryNotFound(result.code, result.stderr ?? '')) {
      return {
        error:
          'ast-grep binary not found. Ensure ast-grep v0.44+ is installed and on PATH. ' +
          'Install via: npm i -g @ast-grep/cli  or  cargo install ast-grep',
      };
    }

    /* No matches — exit code 1 with empty stdout and no real error on stderr */
    if (isNoMatch(result.code, result.stdout, result.stderr ?? '')) {
      return {
        success: true,
        preview: previewOnly,
        output: '',
        matchCount: 0,
      };
    }

    /* Real error */
    if (result.code !== 0) {
      const cleanStderr = filterStderr(result.stderr ?? '');
      return {
        error: `ast-grep exited with code ${result.code}: ${cleanStderr || 'unknown error'}`,
      };
    }

    /* --- Build output and count matches --- */
    let matchCount = 0;
    let rawOutput: string;

    if (previewOnly) {
      /* Preview mode: JSON-stream output on stdout, one JSON object per match */
      const stdout = result.stdout ?? '';
      const stderr = result.stderr ?? '';

      // Parse JSON lines from stdout to count matches
      const jsonLines = stdout
        .split('\n')
        .filter((l: string) => l.trim().length > 0);

      for (const line of jsonLines) {
        try {
          JSON.parse(line); // validate it's JSON (don't need the data for count)
          matchCount++;
        } catch {
          /* skip non-JSON lines */
        }
      }

      // Include filtered stderr (warnings stripped) for preview output,
      // but the primary output is the JSON from stdout.
      const cleanErr = filterStderr(stderr);
      rawOutput = stdout + (cleanErr ? '\n' + cleanErr : '');
    } else {
      /* Apply mode: stdout is empty; stderr has "Applied N changes" plus warnings */
      const stderr = result.stderr ?? '';
      const cleanErr = filterStderr(stderr);

      // Parse "Applied N changes" from stderr (before filtering warnings)
      const appliedMatch = stderr.match(/Applied\s+(\d+)\s+changes?/);
      if (appliedMatch) {
        matchCount = parseInt(appliedMatch[1], 10);
      }

      rawOutput = cleanErr;
    }

    return {
      success: true,
      preview: previewOnly,
      output: truncate(rawOutput),
      matchCount,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `ast-grep replace failed: ${msg}` };
  }
}
