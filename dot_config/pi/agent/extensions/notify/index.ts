/**
 * Notify — Pi notification extension with optional audio.
 *
 * Architecture:
 *   Notification chain:  OSC 777 → OSC 99 (Kitty) → notify-send/osascript → visual bell
 *   Sound chain:         canberra-gtk-play → paplay → aplay
 *   Each layer tries; first success wins.
 *
 * Config:
 *   ~/.config/pi/agent/extensions/notify/notify.json — hot-reloaded on each notification
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
 * Mute:
 *   export PI_NOTIFY_MUTE=1        (env var)
 *   touch /tmp/pi-notify-mute      (file flag)
 *   /notify-mute                   (slash command toggle)
 *
 * Sound toggle:
 *   /notify-sound                  (slash command toggle)
 *
 * Test:
 *   /notify-test [type]            type = "info"|"warning"|"error"
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile, execSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MUTE_FILE = "/tmp/pi-notify-mute";
const SOUND_FLAG_FILE = "/tmp/pi-notify-sound";
const COOLDOWN_MS = 3000;
const EXTENSION_DIR = __dirname;
const CONFIG_PATH = join(homedir(), ".config", "pi", "agent", "extensions", "notify", "notify.json");
const DEFAULT_SOUND = join(EXTENSION_DIR, "chime.oga");

const DEFAULT_CONFIG: NotifyConfig = {
  sound: false,
  notification: true,
  suppressWhenFocused: true,
  volume: 3, // 0–100, relative to system volume. 100 = system volume, 3 = barely audible
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
  volume?: number;
  events?: Record<string, EventConfig>;
  sounds?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let lastNotifyTime = 0;
let muted = false;
let soundEnabled = false;
function checkMuted(): boolean {
  if (process.env.PI_NOTIFY_MUTE) return true;
  if (existsSync(MUTE_FILE)) return true;
  return muted;
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

function loadConfig(): NotifyConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, "utf-8");
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

function isEventEnabled(eventKey: string, key: "sound" | "notification"): boolean {
  const config = loadConfig();
  const eventCfg = config.events?.[eventKey];
  if (eventCfg?.[key] !== undefined) return eventCfg[key]!;
  return config[key] ?? false;
}

function getSoundPath(eventKey: string): string | null {
  const config = loadConfig();
  let path = config.sounds?.[eventKey] ?? null;
  if (path?.startsWith("~")) {
    path = join(homedir(), path.slice(1));
  }
  return path;
}

// ---------------------------------------------------------------------------
// Focused terminal detection
// ---------------------------------------------------------------------------

function isTerminalFocused(): boolean {
  const config = loadConfig();
  if (!config.suppressWhenFocused) return false;
  try {
    const term = process.env.TERM_PROGRAM ?? "";
    if (term === "vscode") {
      return true;
    }
    if (term === "WezTerm") {
      // WezTerm doesn't expose X11/Wayland focus reliably via env vars;
      // fall through to TTY-based detection.
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
        `--hint=int:transient:1 --hint=string:sound-name: ` +
        `"${title.replace(/"/g, '\\"')}" "${body.replace(/"/g, '\\"')}"`,
      { stdio: "ignore", timeout: 3000 },
    );
    return true;
  } catch {
    return false;
  }
}

/** osascript — macOS native notifications */
function sendOsascript(title: string, body: string): boolean {
  try {
    const script =
      `display notification "${body.replace(/"/g, '\\"')}" ` +
      `with title "${title.replace(/"/g, '\\"')}" ` +
      `sound name ""`;
    execSync(`osascript -e '${script}'`, {
      stdio: "ignore",
      timeout: 3000,
    });
    return true;
  } catch {
    return false;
  }
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
  const players = ["canberra-gtk-play", "paplay", "aplay"];
  for (const p of players) {
    try {
      execSync(`which ${p}`, { stdio: "ignore", timeout: 1000 });
      return p;
    } catch { /* not found */ }
  }
  return null;
}

let cachedPlayer: string | null | undefined;

function playSound(soundPath: string): void {
  if (!soundEnabled) return;
  if (!existsSync(soundPath)) return;

  if (cachedPlayer === undefined) {
    cachedPlayer = detectSoundPlayer();
  }
  const player = cachedPlayer;
  if (!player) return;

  const config = loadConfig();
  const vol = config.volume ?? 3;

  let cmd: string;
  if (player === "canberra-gtk-play") {
    // --volume is 0–100
    cmd = `canberra-gtk-play -f "${soundPath}" --volume=${vol}`;
  } else if (player === "paplay") {
    // paplay --volume uses 0–65535
    cmd = `paplay --volume=${Math.round(vol * 655.35)} "${soundPath}"`;
  } else {
    // aplay has no volume flag — plays at system level
    cmd = `aplay -q "${soundPath}"`;
  }
  // Fire-and-forget: do not block the agent
  execFile(cmd, { shell: true, timeout: 5000, stdio: "ignore" });
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

  if (isTerminalFocused()) return "suppressed";

  const config = loadConfig();
  const doNotification = config.notification !== false && isEventEnabled(eventKey, "notification");
  const doSound = isEventEnabled(eventKey, "sound");

  // Sound first (if enabled) — fire-and-forget
  if (doSound) {
    const soundPath = getSoundPath(eventKey);
    if (soundPath) playSound(soundPath);
  }

  if (!doNotification) return "sound-only";

  // Notification chain
  const term = process.env.TERM ?? "";
  const termProgram = process.env.TERM_PROGRAM ?? "";
  const isKitty = !!process.env.KITTY_WINDOW_ID || term.includes("kitty");
  const isOsc777Terminal =
    termProgram === "iTerm.app" ||
    termProgram === "iTerm2" ||
    termProgram === "vscode" ||
    termProgram === "ghostty" ||
    termProgram === "WezTerm" ||
    term === "rxvt-unicode" ||
    process.env.WT_SESSION; // Windows Terminal

  if (isKitty) {
    if (sendOSC99(title, body)) return "osc99";
  }

  if (isOsc777Terminal && sendOSC777(title, body)) return "osc777";

  if (process.platform === "darwin") {
    if (sendOsascript(title, body)) return "osascript";
  } else {
    if (sendNotifySend(title, body)) return "notify-send";
  }

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
  // --- Mute toggle command ---
  pi.registerCommand("notify-mute", {
    description: "Toggle Pi notifications on/off",
    handler: async (_args, ctx) => {
      if (checkMuted()) {
        delete process.env.PI_NOTIFY_MUTE;
        muted = false;
        try {
          if (existsSync(MUTE_FILE)) unlinkSync(MUTE_FILE);
        } catch { /* ignore */ }
        ctx.ui.notify("Notifications: ON", "info");
      } else {
        muted = true;
        ctx.ui.notify("Notifications: OFF", "info");
      }
    },
  });

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
      // Update both global and event-level config
      const config = loadConfig();
      config.sound = soundEnabled;
      if (config.events) {
        for (const key of Object.keys(config.events)) {
          config.events[key].sound = soundEnabled;
        }
      }
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
  pi.on("session_start", () => {
    errorCount = 0;
    if (errorBurstTimer) {
      clearTimeout(errorBurstTimer);
      errorBurstTimer = null;
    }
    // Config is the source of truth — ignore stale flag file
    const config = loadConfig();
    soundEnabled = config.sound ?? false;
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

    errorBurstTimer = setTimeout(() => {
      const count = errorCount;
      errorCount = 0;
      errorBurstTimer = null;

      const body =
        count > 1
          ? `${count} tool errors`
          : `Error in ${formatToolName(event.toolName)}`;
      notify("Pi Error", body, "error", "tool_error").catch(() => {});
    }, 500);
  });
}
