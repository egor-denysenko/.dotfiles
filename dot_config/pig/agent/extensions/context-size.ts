import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MiB`;
}

export default function (pi: ExtensionAPI) {
  let shown = false;
  pi.on("session_start", () => { shown = false; });

  pi.on("before_agent_start", (event, ctx) => {
    if (shown || !ctx.hasUI) return;
    shown = true;

    // The effective system prompt already includes context files and skills.
    const systemBytes = Buffer.byteLength(event.systemPrompt, "utf8");
    const active = new Set(pi.getActiveTools());
    const tools = pi.getAllTools().filter((tool) => active.has(tool.name));
    const toolBytes = Buffer.byteLength(JSON.stringify(tools.map(({ name, description, parameters }) => ({
      name, description, parameters,
    }))), "utf8");
    const totalBytes = systemBytes + toolBytes;
    const tokens = Math.round(totalBytes / 4);
    const tier = tokens < 2000 ? "🟢 LEAN" : tokens < 5000 ? "🟡 MODERATE" : "🔴 HEAVY";
    ctx.ui.notify([
      `📐 Context Overhead: ${formatSize(totalBytes)} (~${(tokens / 1000).toFixed(1)}k tokens) [${tier}]`,
      `   System prompt (includes context/skills): ${formatSize(systemBytes)}`,
      `   Active tool schemas (${tools.length}): ${formatSize(toolBytes)}`,
    ].join("\n"), tokens >= 5000 ? "warning" : "info");
  });
}
