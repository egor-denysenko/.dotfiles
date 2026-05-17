/**
 * Startup Banner Extension
 *
 * Custom header replacing pi's built-in one. Renders:
 *  - "This Is Fine" dog (thisisfine.sh) with full ANSI color
 *  - Startup time in ms
 *  - Loaded context files, skills, extensions, themes
 *
 * Styled to match the original built-in header look.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ART_SCRIPT =
  "/home/bronco/.local/share/chezmoi/dot_config/nvim/utils/thisisfine.sh";

const startTime = Date.now();

// ---------------------------------------------------------------------------
// Theme helper (returns styled text functions)
// ---------------------------------------------------------------------------

interface HeaderTheme {
  label(text: string): string;
  value(text: string): string;
  faint(text: string): string;
}

function mkTheme(theme: {
  fg: (c: string, t: string) => string;
  bold: (t: string) => string;
}): HeaderTheme {
  return {
    label: (t) => theme.bold(theme.fg("accent", t)),
    value: (t) => theme.fg("dim", t),
    faint: (t) => theme.fg("dim", t),
  };
}

// ---------------------------------------------------------------------------
// Art: run thisisfine.sh, keep ANSI colours intact
// ---------------------------------------------------------------------------

/** Strip ANSI escape sequences to measure visual width. */
function visualWidth(line: string): number {
  return line.replace(/\x1b\[[0-9;]*m/g, "").length;
}

function getArtLines(): string[] {
  if (!existsSync(ART_SCRIPT)) return [];
  try {
    const raw = execSync(`bash "${ART_SCRIPT}"`, {
      encoding: "utf-8",
      timeout: 5000,
    });
    return raw.split("\n").filter((l) => l.trim().length > 0);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Context files (CLAUDE.md, AGENTS.md, etc.)
// ---------------------------------------------------------------------------

const CONTEXT_NAMES = [
  "CLAUDE.md",
  "AGENTS.md",
  ".agents.md",
  ".claude.md",
  "CLAUDE.local.md",
];

function findContextFiles(cwd: string): string[] {
  const home = homedir();
  const found: string[] = [];
  const seen = new Set<string>();
  let dir = resolve(cwd);

  while (true) {
    for (const name of CONTEXT_NAMES) {
      const p = join(dir, name);
      if (existsSync(p) && !seen.has(p)) {
        seen.add(p);
        found.push(p);
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
    if (dir.startsWith(home + "/.local") || dir === home) break;
  }
  return found;
}

function renderContext(cwd: string, th: HeaderTheme): string[] {
  const files = findContextFiles(cwd);
  if (files.length === 0) return [];
  const home = homedir();
  const out: string[] = [th.label("[Context]")];
  for (const f of files) {
    const rel = f.startsWith(home) ? `~${f.slice(home.length)}` : f;
    out.push(`  ${th.value(rel)}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Extensions list (directory scan + settings.json packages)
// ---------------------------------------------------------------------------

function collectExtensions(): string[] {
  const home = homedir();
  const names: string[] = [];

  // Global extensions dir
  const globalDir = join(home, ".config/pi/agent/extensions");
  if (existsSync(globalDir)) {
    for (const e of readdirSync(globalDir)) {
      if (e.endsWith(".ts")) names.push(e);
    }
  }

  // Project extensions dir
  const projDir = join(process.cwd(), ".pi/extensions");
  if (existsSync(projDir)) {
    for (const e of readdirSync(projDir)) {
      if (e.endsWith(".ts")) names.push(e);
    }
  }

  // Packages from settings.json
  const settingsPath = join(home, ".config/pi/agent/settings.json");
  if (existsSync(settingsPath)) {
    try {
      const raw = readFileSync(settingsPath, "utf-8");
      const cfg = JSON.parse(raw);
      const pkgs: Array<{
        source?: string;
        extensions?: string[];
      }> = cfg.packages ?? [];
      for (const pkg of pkgs) {
        const src = pkg.source ?? "unknown";
        const exts = pkg.extensions ?? [];
        for (const ext of exts) {
          names.push(`${src}:${ext}`);
        }
      }
    } catch { /* ignore */ }
  }

  return [...new Set(names)].sort();
}

function renderExtensions(th: HeaderTheme): string[] {
  const exts = collectExtensions();
  if (exts.length === 0) return [];
  const out: string[] = [th.label("[Extensions]")];
  out.push(`  ${th.value(exts.join(", "))}`);
  return out;
}

// ---------------------------------------------------------------------------
// Skills list (from pi.getCommands, strip "skill:" prefix)
// ---------------------------------------------------------------------------

function renderSkills(
  pi: ExtensionAPI,
  th: HeaderTheme,
): string[] {
  const cmds = pi.getCommands();
  const names = cmds
    .filter((c) => c.source === "skill")
    .map((c) => c.name.replace(/^skill:/, ""))
    .filter((n) => n.length > 0)
    .sort();
  if (names.length === 0) return [];
  const out: string[] = [th.label("[Skills]")];
  out.push(`  ${th.value(names.join(", "))}`);
  return out;
}

// ---------------------------------------------------------------------------
// Themes list
// ---------------------------------------------------------------------------

function renderThemes(
  ctx: { ui: { getAllThemes(): Array<{ name: string }> } },
  th: HeaderTheme,
): string[] {
  const themes = ctx.ui.getAllThemes();
  if (themes.length <= 1) return [];
  const out: string[] = [th.label("[Themes]")];
  out.push(`  ${th.value(themes.map((t) => t.name).join(", "))}`);
  return out;
}

// ---------------------------------------------------------------------------
// Extension entrypoint
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  let artShown = false;

  pi.on("session_start", async (event, ctx) => {
    if (!ctx.hasUI) return;

    const elapsedMs = Date.now() - startTime;
    ctx.ui.notify(`Pi started in ${elapsedMs}ms`, "info");

    if (event.reason !== "startup" || artShown) return;
    artShown = true;

    const artLines = getArtLines();
    if (artLines.length === 0) return;

    ctx.ui.setHeader((_tui, theme) => {
      const th = mkTheme(theme as any);

      return {
        render(width: number): string[] {
          const artVisualWidth = Math.max(...artLines.map((l) => visualWidth(l)));
          // Pad to centre; also add 1 char of breathing room
          const pad = Math.max(0, Math.floor((width - artVisualWidth) / 2)) + 1;

          const sections = [
            ...renderContext(ctx.cwd, th),
            ...renderExtensions(th),
            ...renderSkills(pi, th),
            ...renderThemes(ctx as any, th),
          ];

          return [
            "",
            ...artLines.map((line) => " ".repeat(pad) + line),
            th.faint(`   startup: ${elapsedMs}ms`),
            "",
            ...sections.flatMap((line, _i, _arr) => [line]),
            "",
          ];
        },
        invalidate() {},
      };
    });
  });
}
