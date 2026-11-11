import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Input, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

type Model = { provider: string; id: string; name?: string };

export default function (pi: ExtensionAPI) {
  const root = process.env.PIG_HOME ?? (process.env.XDG_CONFIG_HOME
    ? join(process.env.XDG_CONFIG_HOME, "pig") : join(homedir(), ".pig"));
  const statePath = join(root, "state", "ui", "model-provider.json");
  let selectedProvider: string | undefined;
  const remembered = new Map<string, string>();

  pi.on("session_start", async () => {
    try {
      const state = JSON.parse(await readFile(statePath, "utf8"));
      if (typeof state.provider === "string") selectedProvider = state.provider;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    }
  });

  const choose = async (ctx: ExtensionContext) => {
    const models = ctx.modelRegistry.getAvailable();
    const providers = [...new Set(models.map((model) => model.provider))].sort();
    if (!providers.length) {
      ctx.ui.notify("No authenticated models available. Use /login first.", "warning");
      return;
    }
    if (ctx.mode === "rpc") {
      const provider = await ctx.ui.select("Provider", providers);
      if (!provider) return;
      const choices = models.filter((model) => model.provider === provider);
      const id = await ctx.ui.select("Model", choices.map((model) => model.id));
      const model = choices.find((model) => model.id === id);
      if (model) await pi.setModel(model);
      return;
    }
    let provider = providers.indexOf(selectedProvider ?? ctx.model?.provider ?? "");
    if (provider < 0) provider = 0;
    const chosen = await ctx.ui.custom<Model | undefined>((tui, theme, _keys, done) => {
      const input = new Input();
      let selected = 0;
      const filtered = () => {
        const query = input.getValue().toLowerCase();
        return models.filter((model) => model.provider === providers[provider]
          && `${model.id} ${model.name}`.toLowerCase().includes(query))
          .sort((a, b) => Number(b.id === ctx.model?.id) - Number(a.id === ctx.model?.id) || a.id.localeCompare(b.id));
      };
      return {
        render(width: number) {
          const list = filtered();
          const start = Math.max(0, selected - 7);
          return [
            theme.fg("accent", `Provider: ${providers[provider]}`),
            ...input.render(width),
            ...list.slice(start, start + 12).map((model, offset) => {
              const text = `${start + offset === selected ? "›" : " "} ${model.id}${model.id === ctx.model?.id && model.provider === ctx.model?.provider ? " ✓" : ""}`;
              return start + offset === selected ? theme.fg("accent", text) : text;
            }),
            ...(list.length ? [] : [theme.fg("dim", "No matching models")]),
            theme.fg("dim", "Tab/Shift+Tab: provider · ↑/↓: model · Enter: select · Esc: cancel"),
          ].map((line) => truncateToWidth(line, width));
        },
        handleInput(data: string) {
          if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) return done(undefined);
          if (matchesKey(data, "tab") || matchesKey(data, "shift+tab")) {
            provider = (provider + (matchesKey(data, "shift+tab") ? -1 : 1) + providers.length) % providers.length;
            selected = 0;
          } else if (matchesKey(data, "up") || matchesKey(data, "down")) {
            const length = filtered().length;
            selected = length ? (selected + (matchesKey(data, "up") ? -1 : 1) + length) % length : 0;
          } else if (matchesKey(data, "enter")) {
            const model = filtered()[selected];
            if (model) done(model);
          } else {
            input.handleInput(data);
            selected = 0;
          }
          tui.requestRender();
        },
        invalidate() {},
      };
    });
    if (!chosen) return;
    const model = models.find((model) => model.provider === chosen.provider && model.id === chosen.id)!;
    if (await pi.setModel(model)) {
      selectedProvider = model.provider;
      remembered.set(model.provider, model.id);
      await mkdir(dirname(statePath), { recursive: true });
      await writeFile(statePath, JSON.stringify({ provider: selectedProvider }) + "\n");
    }
  };

  const cycle = async (ctx: ExtensionContext, direction: number) => {
    const models = ctx.modelRegistry.getAvailable();
    const providers = [...new Set(models.map((model) => model.provider))].sort();
    if (!providers.length) return;
    if (providers.length === 1) {
      const index = models.findIndex((model) => model.id === ctx.model?.id);
      const next = models[(index + direction + models.length) % models.length];
      if (next) await pi.setModel(next);
      return;
    }
    if (ctx.model) remembered.set(ctx.model.provider, ctx.model.id);
    const index = providers.indexOf(ctx.model?.provider ?? "");
    const provider = providers[(index + direction + providers.length) % providers.length];
    const available = models.filter((model) => model.provider === provider);
    const next = available.find((model) => model.id === remembered.get(provider)) ?? available[0];
    if (next) await pi.setModel(next);
  };

  pi.registerCommand("provider-model", { description: "Provider-filtered model picker", handler: async (_args, ctx) => choose(ctx) });
  pi.registerShortcut("ctrl+l", { description: "Provider-filtered model picker", handler: choose });
  pi.registerShortcut("ctrl+p", { description: "Next provider", handler: (ctx) => cycle(ctx, 1) });
  pi.registerShortcut("ctrl+shift+p", { description: "Previous provider", handler: (ctx) => cycle(ctx, -1) });
}
