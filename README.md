# dotfiles

Managed by [chezmoi](https://www.chezmoi.io/).

## Requirements

Required:

- [chezmoi](https://www.chezmoi.io/) 2.x
- `git`, `curl`, and network access (repo clone; Zim bootstraps itself on first shell start)
- `zsh` — becomes your login shell after install

Recommended CLI tools (configs degrade gracefully when they are missing):

| Tool | Used by |
|------|---------|
| neovim | editor, plus `diff`/`merge` tool configured in `chezmoi.toml` |
| starship | prompt |
| fzf, ripgrep, git-delta | zsh completions/aliases, `git diff` |
| zellij, tmux | terminal multiplexers |
| fnm, pnpm | Node version management; `vendor-skills.sh` shells out to `pnpm dlx skills` |
| opencode or pi | coding agents that read the synced `~/.agents/skills/` |

Desktop machines only: the Sway, WezTerm, and Ghostty configs are shipped as plain files — no graphical packages are
installed by `chezmoi apply`. On headless boxes, add the corresponding `.config/...` paths to `.chezmoiignore` to skip
them entirely.

Platform: Linux or macOS.

## Installation

```sh
chezmoi init https://github.com/egor-denysenko/.dotfiles.git && chezmoi apply -v
~/.local/share/chezmoi/scripts/install-skills.sh   # flatten skills into ~/.agents/skills/
chsh -s "$(command -v zsh)"                        # make zsh the login shell
```

`chezmoi init` asks two questions (persisted in `~/.config/chezmoi/chezmoi.toml`):

| Prompt | Values |
|--------|--------|
| `machine` | `personal` / `work` — `work` keeps your own locally managed `.gitconfig` |
| `theme` | `dark` (default) / `light` |

Non-interactive install — pre-seed the answers first:

```sh
mkdir -p ~/.config/chezmoi
printf '[data]\nmachine = "personal"\ntheme = "dark"\n' > ~/.config/chezmoi/chezmoi.toml
chezmoi init https://github.com/egor-denysenko/.dotfiles.git && chezmoi apply -v
```

Re-run `chezmoi apply -v` any time the source repo changes; `run_once_` scripts only execute on the first apply.

## Structure

| Path | Manages |
|------|---------|
| `dot_config/zsh` | Zsh + Zim, fzf, aliases |
| `dot_config/nvim` | Neovim (LazyVim-based) |
| `dot_config/sway` | Sway WM |
| `dot_config/wezterm` | WezTerm terminal |
| `dot_config/ghostty` | Ghostty terminal themes |
| `dot_config/zellij` | Zellij multiplexer |
| `dot_config/starship` | Starship prompt |
| `dot_config/scripts` | Utility scripts |
| `dot_config/pi/agent` | Pi coding agent config (extensions, themes, models) |
| `dot_config/opencode` | OpenCode v2 config: `agents/` (ask, debug), `commands/` (mozzarella) |
| `dot_agents/skills` | Agent skills (synced to `~/.agents/skills/`; pi gets them via a symlink in `~/.pi/agent/skills/`) |

## Templates

Uses `.chezmoi.toml.tmpl` for machine-type (personal/work) and theme (dark/light) data.

## Updating skills

Layout: `dot_agents/skills/personal/<name>/` (hand-written) and `dot_agents/skills/vendored/<name>/` (pulled from upstream). Both opencode and pi recurse, so the split is just organization.

### Add or bump a vendored skill

1. Edit `.chezmoidata/third_party_skills.yaml` — add a group or change a `ref:` (tag or commit SHA, both work).
2. Dry-run: `./scripts/vendor-skills.sh --dry-run`
3. Apply: `./scripts/vendor-skills.sh`
4. `./scripts/install-skills.sh` to push to `~/.agents/skills/`
5. Commit `.chezmoidata/third_party_skills.yaml` + `dot_agents/skills/vendored/`

Script uses `pnpm dlx skills` under the hood. Strips `README.md` from each vendored skill, writes `dot_vendored-version: <source>@<ref>` marker.

### Add a personal skill

`mkdir dot_agents/skills/personal/<name>/`, drop `SKILL.md` with `name:` + `description:` frontmatter, then run `./scripts/install-skills.sh`. No script generation needed.
