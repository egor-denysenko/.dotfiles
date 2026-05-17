/**
 * Temporary fix for opencode-go/opencode providers: normalize "reasoning"
 * field name on replayed assistant messages.
 *
 * Root cause: opencode-go streams thinking deltas with the non-standard
 * field name "reasoning" (no underscore). Pi stores this in the thinking
 * block's `thinkingSignature` and replays it as `assistantMsg["reasoning"]`.
 * Strict OpenAI-compatible APIs reject unknown fields — only the standard
 * "reasoning_content" field is accepted on assistant messages.
 *
 * This extension hooks `before_provider_request` to rename:
 *   "reasoning" → "reasoning_content"
 *   "reasoning_text" → "reasoning_content"
 *
 * This is a TEMPORARY workaround. The proper fix should be upstream in pi
 * (see linked issues below). Once pi merges native handling, this extension
 * can be removed.
 *
 * Why this is better than `requiresThinkingAsText`:
 * - Keeps thinking as structured reasoning (not demoted to plain text)
 * - Model quality preserved — chain-of-thought stays distinct from output
 * - Only touches field names, not content
 *
 * Scoped to opencode-go / opencode providers only. All other providers
 * pass through untouched.
 *
 * See:
 *   https://github.com/earendil-works/pi-mono/issues/4526
 *   https://github.com/earendil-works/pi-mono/issues/4251
 *   https://github.com/earendil-works/pi-mono/issues/4514
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const REASONING_FIELD_NAMES = ["reasoning", "reasoning_text"];

export default function (pi: ExtensionAPI) {
  pi.on("before_provider_request", (event, ctx) => {
    const { payload } = event;

    // Only patch opencode-go / opencode (zen) providers
    if (!event.payload) return undefined;
    const provider = ctx.model?.provider;
    if (provider !== "opencode-go" && provider !== "opencode") return undefined;

    const messages = (payload as any)?.messages;
    if (!Array.isArray(messages)) return undefined;

    let patched = false;

    for (const msg of messages) {
      if (msg.role !== "assistant") continue;

      // Normalize reasoning field names to reasoning_content
      for (const field of REASONING_FIELD_NAMES) {
        if (field in msg && field !== "reasoning_content") {
          const value = msg[field];
          delete msg[field];
          // Only set reasoning_content if it's not already present
          // (avoid overwriting an explicit reasoning_content)
          if (!("reasoning_content" in msg)) {
            msg["reasoning_content"] = value;
          }
          patched = true;
        }
      }
    }

    return patched ? payload : undefined;
  });
}