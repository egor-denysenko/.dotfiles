import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  const stashes: string[] = [];

  const toggle = async (ctx: ExtensionContext) => {
    const text = ctx.ui.getEditorText();
    if (text.length > 0) {
      stashes.push(text);
      ctx.ui.setEditorText("");
    } else if (stashes.length > 0) {
      ctx.ui.setEditorText(stashes.pop()!);
    }
    ctx.ui.setStatus("stashes", stashes.length ? `Stashes: ${stashes.length}` : undefined);
  };

  pi.registerShortcut("ctrl+s", {
    description: "Stash the current prompt, or restore the latest stash",
    handler: toggle,
  });
  pi.registerCommand("stash", { description: "Stash or restore a prompt", handler: async (_args, ctx) => toggle(ctx) });
  pi.registerCommand("stashes", {
    description: "Choose a stashed prompt to restore",
    handler: async (_args, ctx) => {
      if (!stashes.length) {
        ctx.ui.notify("No stashed prompts found.", "info");
        return;
      }
      const labels = stashes.map((text, index) => `[${index + 1}] ${text.replace(/\s+/g, " ").slice(0, 80)}`);
      const selected = await ctx.ui.select("Stashed Prompts", labels);
      const index = selected === undefined ? -1 : labels.indexOf(selected);
      if (index < 0) return;
      const [chosen] = stashes.splice(index, 1);
      const current = ctx.ui.getEditorText();
      if (current) stashes.push(current);
      ctx.ui.setEditorText(chosen);
      ctx.ui.setStatus("stashes", stashes.length ? `Stashes: ${stashes.length}` : undefined);
    },
  });
}
