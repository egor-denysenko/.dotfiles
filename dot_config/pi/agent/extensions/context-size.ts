import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(1)}KiB`;
  const mib = kib / 1024;
  return `${mib.toFixed(1)}MiB`;
}

export default function (pi: ExtensionAPI) {
  let shown = false;

  pi.on("session_start", async () => {
    shown = false;
  });

  pi.on("before_agent_start", async (event, ctx) => {
    if (shown || !event.systemPromptOptions) return;
    shown = true;

    const sysBytes = Buffer.byteLength(event.systemPrompt, "utf-8");
    const contextFiles = event.systemPromptOptions.contextFiles ?? [];

    const contextBytes = contextFiles.reduce(
      (sum, f) => sum + Buffer.byteLength(f.content, "utf-8"),
      0,
    );

    ctx.ui.notify(
      `📐 System prompt ~${formatSize(sysBytes)} · ` +
      `${contextFiles.length} context file${contextFiles.length > 1 ? "s" : ""} ~${formatSize(contextBytes)}`,
      "info"
    );
  });
}
