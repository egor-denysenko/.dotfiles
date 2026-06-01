/**
 * Notify — Pi notification extension with optional audio.
 *
 * Architecture:
 *   Notification chain:  OSC 777 → OSC 99 (Kitty) → notify-send/osascript → visual bell
 *   Sound chain:         canberra-gtk-play → paplay → aplay
 *   Each layer tries; first success wins.
 *
 * Host Config:
 *   ~/.config/pi/agent/extensions/notify/notify.json — hot-reloaded on each notification handled by chezmoi
 *   This config rapresent the end state it should not be changed manually.
 *
 * Chezmoi Config:
 *  ~/.local/share/chezmoi/dot_config/pi/agent/extensions/notify/notify.json -- Actual configuration path to edit and modify.
 *  after doing so config should be applied with chezmoi apply to test on host system resulsts.
 *
 * Events:
 *   agent_end            — task complete / waiting for user input
 *   tool_execution_end   — tool error (isError === true)
 *
 * Anti-spam:
 *   - 3s minimum cooldown between notifications
 *   - Single concurrency gate (overlapping events collapse)
 *   - Error count summarised during burst
 *
 * Sound toggle:
 *   /notify-sound                  (slash command toggle)
 *
 * Test:
 *   /notify-test [type]            type = "info"|"warning"|"error"
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SOUND_FLAG_FILE = "/tmp/pi-notify-sound";
const COOLDOWN_MS = 3000;
const EXTENSION_DIR = __dirname;
const CONFIG_PATH = join(homedir(), ".config", "pi", "agent", "notify.json");
const DEFAULT_SOUND = join(EXTENSION_DIR, "chime.oga");

const DEFAULT_CONFIG: NotifyConfig = {
  sound: false,
  notification: true,
  suppressWhenFocused: true,
  volume_percentage: 100,
  events: {
    agent_end: { sound: false, notification: true },
    tool_error: { sound: false, notification: true },
  },
  sounds: {
    agent_end: DEFAULT_SOUND,
    tool_error: DEFAULT_SOUND,
  },
};

interface EventConfig {
  sound?: boolean;
  notification?: boolean;
}

interface NotifyConfig {
  sound?: boolean;
  notification?: boolean;
  suppressWhenFocused?: boolean;
  volume_percentage?: number;
  events?: Record<string, EventConfig>;
  sounds?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let lastNotifyTime = 0;
let soundEnabled = false;
function checkMuted(): boolean {
  return false;
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

async function loadConfig(): Promise<NotifyConfig> {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = await readFile(CONFIG_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch { /* ignore parse errors, use defaults */ }
  return DEFAULT_CONFIG;
}

function saveConfig(config: NotifyConfig): void {
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
  } catch { /* ignore write errors */ }
}

async function isEventEnabled(eventKey: string, key: "sound" | "notification"): Promise<boolean> {
  const config = await loadConfig();
  const eventCfg = config.events?.[eventKey];
  if (eventCfg?.[key] !== undefined) return eventCfg[key]!;
  return config[key] ?? false;
}

async function getSoundPath(eventKey: string): Promise<string | null> {
  const config = await loadConfig();
  let path = config.sounds?.[eventKey] ?? null;
  if (path?.startsWith("~")) {
    path = join(homedir(), path.slice(1));
  }
  return path;
}

// ---------------------------------------------------------------------------
// Focused terminal detection
// ---------------------------------------------------------------------------

async function isTerminalFocused(): Promise<boolean> {
  const config = await loadConfig();
  if (!config.suppressWhenFocused) return false;
  try {
    const term = process.env.TERM_PROGRAM ?? "";
    if (term === "vscode" || term === "WezTerm") {
      return true;
    }
    const tty = execSync("tty", { timeout: 1000 }).toString().trim();
    if (tty === "/dev/tty" || tty === "not a tty") return false;
    const focused = execSync(
      `loginctl show-session $(loginctl show-user $(whoami) -p Display --value) -p ActiveTTY --value 2>/dev/null || echo ""`,
      { timeout: 2000, stdio: ["pipe", "pipe", "pipe"] },
    ).toString().trim();
    return focused === tty.replace("/dev/", "");
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Notification delivery (priority chain)
// ---------------------------------------------------------------------------

type NotifyLevel = "info" | "warning" | "error";

function escapeOSC(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;");
}

/** OSC 777 — iTerm2, Ghostty, WezTerm, rxvt-unicode, Windows Terminal */
function sendOSC777(title: string, body: string): boolean {
  try {
    process.stdout.write(
      `\x1b]777;notify;${escapeOSC(title)};${escapeOSC(body)}\x07`,
    );
    return true;
  } catch {
    return false;
  }
}

/** OSC 99 — Kitty terminal protocol */
function sendOSC99(title: string, body: string): boolean {
  try {
    process.stdout.write(`\x1b]99;i=1:d=0;${escapeOSC(title)}\x1b\\`);
    process.stdout.write(`\x1b]99;i=1:p=body;${escapeOSC(body)}\x1b\\`);
    return true;
  } catch {
    return false;
  }
}

/** notify-send — Linux / WSL */
function sendNotifySend(title: string, body: string): boolean {
  try {
    execSync(
      `notify-send --urgency=low --expire-time=4000 ` +
        `--hint=int:transient:1 --hint=int:suppress-sound:1 ` +
        `"${title.replace(/"/g, '\\"')}" "${body.replace(/"/g, '\\"')}"`,
      { stdio: "ignore", timeout: 3000 },
    );
    return true;
  } catch {
    return false;
  }
}

/** Build alerter CLI arguments for a notification */
function buildAlerterArguments(title: string, body: string): string[] {
  return ["alerter", "--message", body, "--title", title];
}

/** alerter — macOS desktop notifications (vjeantet/tap/alerter) */
function sendMacOSAlerterNotification(title: string, body: string): boolean {
  try {
    const alerterPath = execSync("which alerter", { stdio: "pipe", timeout: 1000 })
      .toString()
      .trim();
    if (!alerterPath) {
      console.warn(
        "notify: macOS desktop notification skipped; alerter not found on PATH (brew install vjeantet/tap/alerter)",
      );
      return false;
    }

    const alerterArguments = buildAlerterArguments(title, body);
    execSync(`${alerterPath} ${alerterArguments.slice(1).join(" ")}`, {
      stdio: "ignore",
      timeout: 3000,
    });
    return true;
  } catch {
    return false;
  }
}

/** Route to the appropriate desktop notification backend by platform */
function sendDesktopNotificationByPlatform(title: string, body: string): boolean {
  if (process.platform === "darwin") {
    return sendMacOSAlerterNotification(title, body);
  }
  return sendNotifySend(title, body);
}

/** Visual bell — flash the terminal title briefly */
function sendVisualBell(): boolean {
  try {
    const orig = process.title || "";
    process.stdout.write("\x1b]0;🔔 Pi\x07");
    setTimeout(() => {
      process.stdout.write(`\x1b]0;${orig}\x07`);
    }, 800);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Sound delivery (priority chain)
// ---------------------------------------------------------------------------

function detectSoundPlayer(): string | null {
  const platform = process.platform;
  const players = platform === "darwin"
    ? ["afplay"]
    : ["canberra-gtk-play", "paplay", "aplay"];
  for (const p of players) {
    try {
      execSync(`which ${p}`, { stdio: "ignore", timeout: 1000 });
      return p;
    } catch { /* not found */ }
  }
  return null;
}

let cachedPlayer: string | null | undefined;

async function playSound(soundPath: string): Promise<boolean> {
  if (!soundEnabled) return false;
  if (!existsSync(soundPath)) return false;

  const config = await loadConfig();
  const volPct = config.volume_percentage ?? 100;
  const clamped = Math.max(0, Math.min(100, volPct));

  if (cachedPlayer === undefined) {
    cachedPlayer = detectSoundPlayer();
  }
  const player = cachedPlayer;
  if (!player) return false;

  try {
    let cmd: string;
    // Use a cubic power curve so low percentages are actually quiet
    // (human hearing is logarithmic, not linear)
    const effective = Math.pow(clamped / 100, 3);
    if (player === "canberra-gtk-play") {
      // --volume is 0–10000
      const vol = Math.round(effective * 10000);
      cmd = `canberra-gtk-play --volume=${vol} -f "${soundPath}"`;
    } else if (player === "paplay") {
      // --volume is 0–10000
      const vol = Math.round(effective * 10000);
      cmd = `paplay --volume=${vol} "${soundPath}"`;
    } else if (player === "afplay") {
      // -v is 0.0–1.0
      cmd = `afplay -v ${effective.toFixed(4)} "${soundPath}"`;
    } else {
      // aplay --volume-soft is 0–100
      const vol = Math.round(effective * 100);
      cmd = `aplay --volume-soft=${vol} -q "${soundPath}"`;
    }
    execSync(cmd, { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Combined notify
// ---------------------------------------------------------------------------

/** Return which notification layer succeeded (empty string = none) */
async function notify(
  title: string,
  body: string,
  level: NotifyLevel,
  eventKey: string,
): Promise<string> {
  if (checkMuted()) return "muted";

  const now = Date.now();
  if (now - lastNotifyTime < COOLDOWN_MS) return "cooldown";
  lastNotifyTime = now;

  if (await isTerminalFocused()) return "suppressed";

  const config = await loadConfig();
  const doNotification = config.notification !== false && await isEventEnabled(eventKey, "notification");
  const doSound = await isEventEnabled(eventKey, "sound");

  // Sound first (if enabled)
  if (doSound) {
    const soundPath = await getSoundPath(eventKey);
    if (soundPath) await playSound(soundPath);
  }

  if (!doNotification) return "sound-only";

  // Notification chain
  const term = process.env.TERM ?? "";
  const isKitty = !!process.env.KITTY_WINDOW_ID || term.includes("kitty");

  if (isKitty) {
    if (sendOSC99(title, body)) return "osc99";
  }

  if (sendOSC777(title, body)) return "osc777";

  if (sendDesktopNotificationByPlatform(title, body)) return "desktop";

  sendVisualBell();
  return "visual-bell";
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function formatToolName(name: string): string {
  if (name.length > 30) return name.slice(0, 27) + "...";
  return name;
}

export default function (pi: ExtensionAPI) {
  // --- Sound toggle command ---
  pi.registerCommand("notify-sound", {
    description: "Toggle Pi notification sounds on/off",
    handler: async (_args, ctx) => {
      soundEnabled = !soundEnabled;
      try {
        if (soundEnabled) {
          writeFileSync(SOUND_FLAG_FILE, "");
        } else {
          if (existsSync(SOUND_FLAG_FILE)) unlinkSync(SOUND_FLAG_FILE);
        }
      } catch { /* ignore */ }
      // Also update config
      const config = await loadConfig();
      config.sound = soundEnabled;
      saveConfig(config);
      ctx.ui.notify(`Sound: ${soundEnabled ? "ON" : "OFF"}`, "info");
    },
  });

  // --- Test command ---
  pi.registerCommand("notify-test", {
    description: "Test notifications: /notify-test [info|warning|error]",
    handler: async (args, ctx) => {
      const level: NotifyLevel =
        args === "error" || args === "warning" ? args : "info";
      const icon = level === "error" ? "\u2717" : level === "warning" ? "\u26a0" : "\u2713";
      const title = "Pi Test";
      const body = `${icon} Test notification (${level})`;
      const eventKey = "agent_end";
      const result = await notify(title, body, level, eventKey);
      ctx.ui.notify(`Sent: ${result} — "${body}"`, level === "error" ? "error" : "info");
    },
  });

  // --- session_start: reset state ---
  pi.on("session_start", async () => {
    errorCount = 0;
    if (errorBurstTimer) {
      clearTimeout(errorBurstTimer);
      errorBurstTimer = null;
    }
    // Load sound state from file flag
    soundEnabled = existsSync(SOUND_FLAG_FILE);
    const config = await loadConfig();
    if (config.sound !== undefined) soundEnabled = config.sound;
  });

  // --- agent_end: task complete / waiting for input ---
  pi.on("agent_end", async () => {
    await notify("Pi", "Done — waiting for input", "info", "agent_end");
  });

  // --- tool_execution_end: error detection ---
  let errorCount = 0;
  let errorBurstTimer: ReturnType<typeof setTimeout> | null = null;

  pi.on("tool_execution_end", async (event) => {
    if (!event.isError) return;
    errorCount++;

    if (errorBurstTimer) {
      clearTimeout(errorBurstTimer);
    }

    errorBurstTimer = setTimeout(async () => {
      const count = errorCount;
      errorCount = 0;
      errorBurstTimer = null;

      const body =
        count > 1
          ? `${count} tool errors`
          : `Error in ${formatToolName(event.toolName)}`;
      await notify("Pi Error", body, "error", "tool_error");
    }, 500);
  });
}
