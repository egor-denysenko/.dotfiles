import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event) => {
    const defaultPrompt = event.systemPrompt;
    
    // Extract the live, interpolated tools list
    const toolsMatch = defaultPrompt.match(/Available tools:\n([\s\S]*?)\n\nIn addition/);
    const toolsList = toolsMatch ? toolsMatch[1] : "";

    // Extract the live, interpolated guidelines
    const guidelinesMatch = defaultPrompt.match(/Guidelines:\n([\s\S]*?)(?:\n\nPi documentation|$)/);
    const guidelines = guidelinesMatch ? guidelinesMatch[1] : "";

    // Construct the new, optimized prompt
    const newPrompt = `Direct. No fluff. Fix code. Ship it.

Tools: ${toolsList}

Guidelines: ${guidelines}`;

    // Replace the system prompt
    return {
      systemPrompt: newPrompt,
    };
  });
}
