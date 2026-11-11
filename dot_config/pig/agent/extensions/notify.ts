import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

interface Config {
  sound: boolean;
  notification: boolean;
  volume_percentage: number;
  events: Record<string, { sound?: boolean; notification?: boolean }>;
}

export default function (pi: ExtensionAPI) {
  const configPath = join(__dirname, "ui-assets", "notify.json");
  let muted = Boolean(process.env.PIG_NOTIFY_MUTE);
  let lastNotification = 0;
  let sending = false;
  const load = async (): Promise<Config> => JSON.parse(await readFile(configPath, "utf8"));

  const notify = async (ctx: ExtensionContext, event: string, body: string) => {
    if (!ctx.hasUI || muted) return "muted";
    if (sending || Date.now() - lastNotification < 3000) return "cooldown";
    sending = true;
    try {
      const config = await load();
      const flags = config.events[event] ?? {};
      const sound = config.sound && flags.sound !== false;
      const desktop = config.notification && flags.notification !== false;
      if (!sound && !desktop) return "disabled";
      lastNotification = Date.now();
      if (sound) {
        const volume = Math.pow(Math.max(0, Math.min(100, config.volume_percentage)) / 100, 3);
        if (process.platform === "darwin") {
          await pi.exec("afplay", ["-v", String(volume), "/System/Library/Sounds/Glass.aiff"], { timeout: 5000 });
        } else {
          await pi.exec("canberra-gtk-play", ["--id=complete", `--volume=${Math.round(volume * 10000)}`], { timeout: 5000 });
        }
      }
      if (!desktop) return "sound-only";
      // Extension stdout is a subprocess pipe, not the host terminal. Use a
      // desktop backend instead of writing OSC notification sequences there.
      if (process.platform === "darwin") {
        const quote = (text: string) => JSON.stringify(text.replace(/[\r\n]/g, " "));
        const result = await pi.exec("osascript", ["-e", `display notification ${quote(body)} with title "PiG" sound name ""`], { timeout: 3000 });
        return result.code === 0 ? "desktop" : "failed";
      }
      const result = await pi.exec("notify-send", ["--urgency=low", "--hint=int:suppress-sound:1", "PiG", body], { timeout: 3000 });
      return result.code === 0 ? "desktop" : "failed";
    } catch (error) {
      ctx.ui.notify(`Notification failed: ${String(error)}`, "warning");
      return "failed";
    } finally {
      sending = false;
    }
  };

  pi.registerCommand("notify-mute", {
    description: "Toggle PiG notifications",
    handler: async (_args, ctx) => {
      muted = !muted;
      ctx.ui.notify(`Notifications: ${muted ? "OFF" : "ON"}`, "info");
    },
  });
  pi.registerCommand("notify-sound", {
    description: "Toggle PiG notification sounds",
    handler: async (_args, ctx) => {
      const config = await load();
      config.sound = !config.sound;
      for (const event of Object.values(config.events)) event.sound = config.sound;
      await writeFile(configPath, JSON.stringify(config, null, 2) + "\n");
      ctx.ui.notify(`Sound: ${config.sound ? "ON" : "OFF"}`, "info");
    },
  });
  pi.registerCommand("notify-test", {
    description: "Send a test desktop notification",
    handler: async (_args, ctx) => {
      ctx.ui.notify(`Notification: ${await notify(ctx, "agent_end", "Test notification")}`, "info");
    },
  });
  pi.on("agent_end", async (_event, ctx) => { await notify(ctx, "agent_end", "Done — waiting for input"); });
  pi.on("tool_execution_end", async (event, ctx) => {
    if (event.isError) await notify(ctx, "tool_error", `Error in ${event.toolName}`);
  });
}
