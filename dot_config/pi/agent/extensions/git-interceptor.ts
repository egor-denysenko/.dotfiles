/**
 * Git Interceptor
 *
 * Three guards for agent-driven git commands:
 *
 * 1. Editor hang prevention — Sets GIT_EDITOR, GIT_SEQUENCE_EDITOR to `true`
 *    (no-op) and GIT_MERGE_AUTOEDIT to `no` so git never spawns an interactive
 *    editor (nvim, vim, etc.) that would hang the bash process.
 *
 * 2. Hook bypass prevention — Blocks any command containing `--no-verify` so
 *    the agent cannot circumvent git hooks (pre-commit, commit-msg, etc.).
 *    The agent should fix hook failures or ask the human for help instead.
 *
 * 3. GPG signature bypass prevention — Blocks `--no-gpg-sign`, `--no-sign`,
 *    and `-c commit.gpgsign=false` overrides so the agent cannot skip commit
 *    signing. If the user explicitly allows it via the confirmation dialog,
 *    the command proceeds.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";

const GIT_ENV_PREFIX =
    "export GIT_EDITOR=true GIT_SEQUENCE_EDITOR=true GIT_MERGE_AUTOEDIT=no\n";

const GIT_CMD_RE = /(?:^|[;&|])\s*git\b/;
const NO_VERIFY_RE = /--no-verify\b/;

const NO_VERIFY_REASON =
    "BLOCKED: --no-verify is not allowed. Git hooks exist for a reason. " +
    "Do not attempt to bypass them. Instead: fix the underlying issue that " +
    "is causing the hook to fail, or ask the user for help.";

const NO_GPG_REASON =
    "BLOCKED: Skipping GPG signing is not allowed. " +
    "Commits must be signed. If signing fails, debug the GPG/key issue instead " +
    "of bypassing it. Use --no-gpg-sign only when the human explicitly approves.";

const NO_GPG_RE = /(?:--no-gpg-sign|--no-sign)\b|\s-c\s+commit\.gpgsign=false/i;

export default function (pi: ExtensionAPI) {
    pi.on("tool_call", async (event, ctx) => {
        if (!isToolCallEventType("bash", event)) return;
        const cmd = event.input.command;
        if (!GIT_CMD_RE.test(cmd)) return;

        if (NO_VERIFY_RE.test(cmd)) {
            return { block: true, reason: NO_VERIFY_REASON };
        }

        if (NO_GPG_RE.test(cmd)) {
            const allowed = await ctx.ui.confirm(
                "Skip GPG signing?",
                "The agent wants to bypass GPG commit signing. Allow this?",
            );
            if (!allowed) {
                return { block: true, reason: NO_GPG_REASON };
            }
        }

        event.input.command = GIT_ENV_PREFIX + cmd;
    });
}
