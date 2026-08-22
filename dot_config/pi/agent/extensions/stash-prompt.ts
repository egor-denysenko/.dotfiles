import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { CustomEditor } from "@earendil-works/pi-coding-agent";

let originalHandleInput: ((keyData: string) => void) | null = null;
let stashedPrompts: string[] = [];

export default function (pi: ExtensionAPI) {
  pi.on("session_start", () => {
    const proto = CustomEditor.prototype as unknown as Record<string, unknown>;
    if (originalHandleInput !== null) return;
    originalHandleInput = proto.handleInput as (keyData: string) => void;

    proto.handleInput = function (this: Record<string, unknown>, keyData: string) {
      // ctrl+s is \u0013
      if (keyData === "\u0013") {
        const getText = this.getText as (() => string) | undefined;
        const setText = this.setText as ((text: string) => void) | undefined;
        const currentText = getText ? getText() : "";

        if (currentText.length > 0) {
          // Push to stashed prompts stack
          stashedPrompts.push(currentText);
          if (setText) setText("");
        } else if (stashedPrompts.length > 0) {
          // Pop the latest stashed prompt
          const prompt = stashedPrompts.pop();
          if (prompt !== undefined && setText) {
            setText(prompt);
          }
        }
        return;
      }

      if (originalHandleInput) {
        originalHandleInput.call(this, keyData);
      }
    };
  });

  pi.on("session_shutdown", () => {
    if (originalHandleInput !== null) {
      const proto = CustomEditor.prototype as unknown as Record<string, unknown>;
      proto.handleInput = originalHandleInput;
      originalHandleInput = null;
    }
  });

  pi.registerCommand("stashes", {
    description: "Visualize and manage stashed prompts",
    handler: async (args, ctx) => {
      if (stashedPrompts.length === 0) {
        ctx.ui.notify("No stashed prompts found.", "info");
        return;
      }

      const items = stashedPrompts.map((p, idx) => ({
        id: String(idx),
        label: `[${idx + 1}] ${p.length > 60 ? p.slice(0, 57) + "..." : p}`,
        description: p,
      }));

      const selected = await ctx.ui.select("Stashed Prompts", items);
      if (selected) {
        const idx = Number(selected.id);
        const [chosen] = stashedPrompts.splice(idx, 1);
        if (chosen !== undefined) {
          ctx.ui.setInputValue(chosen);
          ctx.ui.notify("Restored stashed prompt to input.", "success");
        }
      }
    },
  });
}
