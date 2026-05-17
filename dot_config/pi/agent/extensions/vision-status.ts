/**
 * Vision Status Extension — custom footer with vision indicator.
 *
 * Replicates the default pi footer (pwd, tokens, cost, context%, model,
 * thinking level, extension statuses) and adds 👁 ✓ / 👁 ✗ after
 * the thinking level on the right side.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

// ---------------------------------------------------------------------------
// Helpers — mirrored from the default footer
// ---------------------------------------------------------------------------

function sanitizeStatusText(text: string): string {
  return text
    .replace(/[\r\n\t]/g, " ")
    .replace(/ +/g, " ")
    .trim();
}

function fmt(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1_000_000) return `${Math.round(count / 1000)}k`;
  if (count < 10_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  return `${Math.round(count / 1_000_000)}M`;
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  let thinkingLevel = "off";

  pi.on("thinking_level_select", async (event) => {
    thinkingLevel = event.level;
  });

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    ctx.ui.setFooter((tui, theme, footerData) => {
      const unsub = footerData.onBranchChange(() => tui.requestRender());

      return {
        dispose: unsub,
        invalidate() {},
        render(width: number): string[] {
          // ------ token stats from all session entries ------
          let totalInput = 0;
          let totalOutput = 0;
          let totalCacheRead = 0;
          let totalCacheWrite = 0;
          let totalCost = 0;

          for (const entry of ctx.sessionManager.getEntries()) {
            if (entry.type === "message" && entry.message.role === "assistant") {
              const m = entry.message as AssistantMessage;
              totalInput += m.usage.input;
              totalOutput += m.usage.output;
              totalCacheRead += m.usage.cacheRead;
              totalCacheWrite += m.usage.cacheWrite;
              totalCost += m.usage.cost.total;
            }
          }

          // ------ context usage ------
          const contextUsage = ctx.getContextUsage();
          const contextWindow =
            contextUsage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
          const contextPercentValue = contextUsage?.percent ?? 0;
          const contextPercent =
            contextUsage?.percent !== null
              ? contextPercentValue.toFixed(1)
              : "?";

          // ------ pwd ------
          let pwd = ctx.sessionManager.getCwd();
          const home = process.env.HOME || process.env.USERPROFILE;
          if (home && pwd.startsWith(home)) {
            pwd = `~${pwd.slice(home.length)}`;
          }

          const branch = footerData.getGitBranch();
          if (branch) pwd = `${pwd} (${branch})`;

          const sessionName = ctx.sessionManager.getSessionName();
          if (sessionName) pwd = `${pwd}  •  ${sessionName}`;

          // ------ stats line (left) ------
          const parts: string[] = [];
          if (totalInput) parts.push(`↑${fmt(totalInput)}`);
          if (totalOutput) parts.push(`↓${fmt(totalOutput)}`);
          if (totalCacheRead) parts.push(`R${fmt(totalCacheRead)}`);
          if (totalCacheWrite) parts.push(`W${fmt(totalCacheWrite)}`);

          const usingSubscription = ctx.model
            ? ctx.modelRegistry.isUsingOAuth(ctx.model)
            : false;
          if (totalCost || usingSubscription) {
            parts.push(
              `$${totalCost.toFixed(3)}${usingSubscription ? " (sub)" : ""}`,
            );
          }

          const autoIndicator = " (auto)"; // mirrors default
          const ctxDisplay =
            contextPercent === "?"
              ? `?/${fmt(contextWindow)}${autoIndicator}`
              : `${contextPercent}%/${fmt(contextWindow)}${autoIndicator}`;

          let contextStr: string;
          if (contextPercentValue > 90) {
            contextStr = theme.fg("error", ctxDisplay);
          } else if (contextPercentValue > 70) {
            contextStr = theme.fg("warning", ctxDisplay);
          } else {
            contextStr = ctxDisplay;
          }
          parts.push(contextStr);

          let statsLeft = parts.join(" ");

          // ------ right side ------
          const model = ctx.model;
          const modelName = model?.id || "no-model";

          let rightSide = modelName;

          if (model?.reasoning) {
            rightSide =
              thinkingLevel === "off"
                ? `${modelName}  •  thinking off`
                : `${modelName}  •  ${thinkingLevel}`;
          }

          // vision indicator
          const hasVision = model?.input?.includes("image");
          const visIcon = hasVision
            ? theme.fg("accent", "👁 ✓")
            : theme.fg("dim", "👁 ✗");
          rightSide += `  ${visIcon}`;

          if (
            footerData.getAvailableProviderCount() > 1 &&
            model
          ) {
            const withProvider = `(${model.provider}) ${rightSide}`;
            if (visibleWidth(statsLeft) + 2 + visibleWidth(withProvider) <= width) {
              rightSide = withProvider;
            }
          }

          // ------ layout ------
          let statsLeftW = visibleWidth(statsLeft);
          if (statsLeftW > width) {
            statsLeft = truncateToWidth(statsLeft, width, "...");
            statsLeftW = visibleWidth(statsLeft);
          }

          const rightW = visibleWidth(rightSide);
          const totalNeeded = statsLeftW + 2 + rightW;

          let statsLine: string;
          if (totalNeeded <= width) {
            const pad = " ".repeat(width - statsLeftW - rightW);
            statsLine = statsLeft + pad + rightSide;
          } else {
            const avail = width - statsLeftW - 2;
            if (avail > 0) {
              const truncRight = truncateToWidth(rightSide, avail, "");
              const pad = " ".repeat(
                Math.max(0, width - statsLeftW - visibleWidth(truncRight)),
              );
              statsLine = statsLeft + pad + truncRight;
            } else {
              statsLine = statsLeft;
            }
          }

          const lines: string[] = [
            truncateToWidth(theme.fg("dim", pwd), width, theme.fg("dim", "...")),
            theme.fg("dim", statsLeft) +
              theme.fg("dim", statsLine.slice(statsLeft.length)),
          ];

          // ------ extension statuses (from other extensions using setStatus) ------
          const statuses = footerData.getExtensionStatuses();
          if (statuses.size > 0) {
            const sorted = Array.from(statuses.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([, text]) => sanitizeStatusText(text))
              .join(" ");
            lines.push(
              truncateToWidth(sorted, width, theme.fg("dim", "...")),
            );
          }

          return lines;
        },
      };
    });
  });
}
