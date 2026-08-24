import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(1)}KiB`;
  const mib = kib / 1024;
  return `${mib.toFixed(1)}MiB`;
}

function estimateTokens(bytes: number): number {
  return Math.round(bytes / 4);
}

function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  return `${(tokens / 1000).toFixed(1)}k`;
}

function tierLabel(tokens: number): { label: string; emoji: string; level: "lean" | "moderate" | "heavy" } {
  if (tokens < 2000) return { label: "LEAN", emoji: "🟢", level: "lean" };
  if (tokens < 5000) return { label: "MODERATE", emoji: "🟡", level: "moderate" };
  return { label: "HEAVY", emoji: "🔴", level: "heavy" };
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

    // Estimate active tool schema overhead (approximate)
    const activeTools = pi.getActiveTools();
    const toolSchemaBytes = Buffer.byteLength(
      JSON.stringify(activeTools.map(t => ({ name: t.name, description: t.description }))),
      "utf-8"
    );

    const totalBytes = sysBytes + contextBytes + toolSchemaBytes;
    const totalTokens = estimateTokens(totalBytes);

    const tier = tierLabel(totalTokens);

    const lines = [
      `📐 Context Overhead: ${formatSize(totalBytes)} (~${formatTokens(totalTokens)} tokens) [${tier.emoji} ${tier.label}]`,
      `   ├─ System Prompt: ${formatSize(sysBytes)} (~${formatTokens(estimateTokens(sysBytes))} tokens)`,
      `   ├─ Context Files (${contextFiles.length}): ${formatSize(contextBytes)} (~${formatTokens(estimateTokens(contextBytes))} tokens)`,
      `   └─ Active Tools (${activeTools.length}): ${formatSize(toolSchemaBytes)} (~${formatTokens(estimateTokens(toolSchemaBytes))} tokens)`,
    ];

    const level = tier.level === "heavy" ? "error" : tier.level === "moderate" ? "warning" : "info";
    ctx.ui.notify(lines.join("\n"), level);
  });
}