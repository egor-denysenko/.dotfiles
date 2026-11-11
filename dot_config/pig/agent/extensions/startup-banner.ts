/**
 * Startup Banner Extension
 *
 * Startup widget alongside PiG's native mascot header. Renders:
 *  - Sheriff pig in flames (pig-is-fine.sh) with full ANSI color
 *  - Startup time in ms
 *  - Loaded context files, skills, extensions, themes
 *
 * Styled to match the original built-in header look.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { visibleWidth, truncateToWidth } from "@earendil-works/pi-tui";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const AGENT_DIR = process.env.PIG_CODING_AGENT_DIR ?? join(
  process.env.PIG_HOME ?? (process.env.XDG_CONFIG_HOME
    ? join(process.env.XDG_CONFIG_HOME, "pig") : join(homedir(), ".pig")),
  "agent",
);
const ART_SCRIPT = join(__dirname, "pig-is-fine.sh");

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
// Art: run pig-is-fine.sh, keep ANSI colours intact
// ---------------------------------------------------------------------------

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
  "AGENTS.override.md", "AGENTS.md", "AGENTS.MD", "CLAUDE.md", "CLAUDE.MD",
];

function findContextFiles(cwd: string): string[] {
  const dirs = [AGENT_DIR];
  const parents: string[] = [];
  let dir = resolve(cwd);
  while (true) {
    parents.unshift(dir);
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  dirs.push(...parents);
  return [...new Set(dirs.flatMap((directory) => {
    const name = CONTEXT_NAMES.find((name) => existsSync(join(directory, name)));
    return name ? [join(directory, name)] : [];
  }))];
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

async function collectExtensions(): Promise<string[]> {
  const names: string[] = [];

  // Global extensions dir
  const globalDir = join(AGENT_DIR, "extensions");
  if (existsSync(globalDir)) {
    try {
      const entries = await readdir(globalDir);
      for (const e of entries) {
        if (e.endsWith(".ts")) names.push(e);
      }
    } catch { /* ignore */ }
  }

  // Packages from settings.json
  const settingsPath = join(AGENT_DIR, "settings.json");
  if (existsSync(settingsPath)) {
    try {
      const raw = await readFile(settingsPath, "utf-8");
      const cfg = JSON.parse(raw);
      for (const pkg of cfg.packages ?? []) {
        names.push(typeof pkg === "string" ? pkg : pkg.source);
      }
    } catch { /* ignore */ }
  }

  return [...new Set(names)].sort();
}

function renderExtensions(exts: string[], th: HeaderTheme): string[] {
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
// Tools list
// ---------------------------------------------------------------------------

function renderTools(pi: ExtensionAPI, th: HeaderTheme): string[] {
  const active = pi.getActiveTools();
  const all = pi.getAllTools().map(t => t.name);

  if (active.length === all.length) {
    const out: string[] = [th.label('[Tools]')];
    out.push(`  ${th.value(active.join(', '))}`);
    return out;
  }

  const missing = all.filter(t => !active.includes(t));
  const out: string[] = [th.label('[Tools]')];
  out.push(`  ${th.value(active.join(', '))}`);
  out.push(`  ${th.faint('pruned:')} ${th.faint(missing.join(', '))}`);
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
  let visible = false;
  let show: (() => void) | undefined;

  pi.registerCommand("startup", {
    description: "Toggle the Pig Is Fine startup widget (keeps PiG's mascot)",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI || !show) return;
      if (visible) ctx.ui.setWidget("startup-banner", undefined);
      else show();
      visible = !visible;
    },
  });

  pi.on("before_agent_start", (_event, ctx) => {
    ctx.ui.setWidget("startup-banner", undefined);
    visible = false;
  });

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    const elapsedMs = Date.now() - startTime;
    ctx.ui.notify(`PiG UI ready in ${elapsedMs}ms`, "info");

    if (artShown) return;
    artShown = true;

    const artLines = getArtLines();
    if (artLines.length === 0) return;

    const extensions = await collectExtensions();

    // Leave the native header untouched: it owns the mascot and /sprite.
    show = () => ctx.ui.setWidget("startup-banner", (_tui, theme) => {
      const th = mkTheme(theme as any);

      return {
        render(width: number): string[] {
          const artVisualWidth = Math.max(...artLines.map((l) => visibleWidth(l)));
          // Pad to centre; also add 1 char of breathing room
          const pad = Math.max(0, Math.floor((width - artVisualWidth) / 2)) + 1;

          const sections = [
            ...renderContext(ctx.cwd, th),
            ...renderExtensions(extensions, th),
            ...renderSkills(pi, th),
            ...renderTools(pi, th),
            ...renderThemes(ctx as any, th),
          ];

          const fit = (line: string) =>
            visibleWidth(line) > width ? truncateToWidth(line, width) : line;

          return [
            "",
            ...artLines.map((line) => fit(" ".repeat(pad) + line)),
            fit(th.faint(`   startup: ${elapsedMs}ms`)),
            "",
            ...sections.map(fit),
            "",
          ];
        },
        invalidate() {},
      };
    });
    show();
    visible = true;
  });
}
