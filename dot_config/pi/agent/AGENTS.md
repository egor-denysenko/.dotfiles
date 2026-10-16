Use edit over write.
Test after changes.

Optional private defaults belong in `~/.config/chezmoi/chezmoi.toml` as
`pi_private_default_provider` and `pi_private_default_model`; the template
falls back to `llmgateway` and `free-auto` when they are absent.

## Pi self-documentation (local to this chezmoi directory)

This file is excluded from chezmoi deployment; keep this guidance out of the
global agent instructions and `SYSTEM.md`.

From [Pi's default system prompt](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/system-prompt.ts),
with runtime path placeholders replaced by package-relative locations.
Pi is installed globally with pnpm (`@earendil-works/pi-coding-agent`).
Locate the installed package through the `pi` executable (follow its symlink or
pnpm shim); do not hard-code a versioned package path.

When updating Pi itself, unset `PI_OFFLINE` for the update process (e.g.
`env -u PI_OFFLINE pi` before invoking self-update). It interferes with Pi's
self-update feature in this installation. Do not permanently change the shell's
offline default just to perform an update.

Pi documentation (read only when the user asks about pi itself, its SDK, extensions, themes, skills, or TUI):
- Main documentation: README.md in the installed package
- Additional docs: docs/ in the installed package
- Examples: examples/ in the installed package (extensions, custom tools, SDK)
- When reading pi docs or examples, resolve docs/... under Additional docs and examples/... under Examples, not the current working directory
- When asked about: extensions (docs/extensions.md, examples/extensions/), themes (docs/themes.md), skills (docs/skills.md), prompt templates (docs/prompt-templates.md), TUI components (docs/tui.md), keybindings (docs/keybindings.md), SDK integrations (docs/sdk.md), custom providers (docs/custom-provider.md), adding models (docs/models.md), pi packages (docs/packages.md), environment variables (docs/environment-variables.md), MCP servers (docs/mcp.md)
- When working on pi topics, read the docs and examples, and follow .md cross-references before implementing
- Always read pi .md files completely and follow links to related docs (e.g., tui.md for TUI API details)

## Native MCP scaffold

Read [`~/.pi/agent/MCP.md`](~/.pi/agent/MCP.md) and the current
[official MCP documentation](https://pi.dev/docs/latest/mcp) before adding servers.
No servers are provisioned by this scaffold; do not install an MCP adapter.

The empty `~/.pi/agent/mcp.json` is managed with chezmoi's `create_` attribute so
later applies do not overwrite personal server entries. This installation sets
`PI_CODING_AGENT_DIR=~/.config/pi/agent`; its `mcp.json` links to that file.
Keep personal server configuration and credentials out of the dotfiles source.
After adding a server, run `pi mcp list`, then `/reload` in an existing session.
