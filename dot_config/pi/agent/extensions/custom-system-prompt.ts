import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Custom system prompt: swap the intro paragraph and remove PI docs.
 *
 * PI builds the full default prompt (Available tools, Guidelines,
 * <project_context> with AGENTS.md, skills, date, cwd). We keep those dynamic
 * sections and replace only the opening paragraph with a terser one. We also
 * remove PI's hardcoded self-documentation block because it is irrelevant to
 * normal coding sessions.
 *
 * This is intentionally minimal surgery anchored on the stable "\n\nAvailable
 * tools:" and "\n\nPi documentation" markers. If the default shape changes,
 * we keep the safe parts we can identify and leave the rest untouched rather
 * than risk dropping context like AGENTS.md.
 */
const CUSTOM_INTRO = "Direct. No fluff. Fix code. Ship it.";
const EXPORT_PROMPT_SNAPSHOT_CUSTOM_TYPE = "pi.effective_system_prompt";

const TOOLS_MARKER = "\n\nAvailable tools:";
const PI_DOCS_MARKER = "\n\nPi documentation";
const PROJECT_CONTEXT_MARKER = "\n\n<project_context>";

function removePiDocs(prompt: string) {
  const docsStart = prompt.indexOf(PI_DOCS_MARKER);
  if (docsStart === -1) {
    return prompt;
  }

  const docsEnd = prompt.indexOf(PROJECT_CONTEXT_MARKER, docsStart + PI_DOCS_MARKER.length);
  if (docsEnd === -1) {
    return prompt;
  }

  return prompt.slice(0, docsStart) + prompt.slice(docsEnd);
}

function getExportSnapshot(systemPrompt: string, pi: ExtensionAPI) {
  const activeToolNames = new Set(pi.getActiveTools());

  return {
    version: 1,
    systemPrompt,
    tools: pi.getAllTools()
      .filter((tool) => activeToolNames.has(tool.name))
      .map(({ name, ...rest }) => ({
        name,
        ...rest,
      })),
  };
}

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", (event, ctx) => {
    const fullPrompt = event.systemPrompt ?? "";
    if (!fullPrompt) {
      return;
    }

    const markerIndex = fullPrompt.indexOf(TOOLS_MARKER);
    if (markerIndex === -1) {
      // No default tools section to anchor on; don't risk losing context.
      return;
    }

    // Keep everything from "Available tools:" onward (tools, guidelines,
    // project_context/AGENTS.md, skills, date, cwd). Replace only the intro
    // paragraph that precedes it, then drop PI's hardcoded docs block.
    const newPrompt = removePiDocs(CUSTOM_INTRO + fullPrompt.slice(markerIndex));
    const snapshot = getExportSnapshot(newPrompt, pi);
    const snapshotJson = JSON.stringify(snapshot);
    const hasDuplicate = ctx.sessionManager
      .getBranch()
      .some(
        (entry) =>
          entry.type === "custom" &&
          entry.customType === EXPORT_PROMPT_SNAPSHOT_CUSTOM_TYPE &&
          JSON.stringify(entry.data) === snapshotJson,
      );

    if (!hasDuplicate) {
      pi.appendEntry(EXPORT_PROMPT_SNAPSHOT_CUSTOM_TYPE, snapshot);
    }

    return {
      systemPrompt: newPrompt,
    };
  });
}
