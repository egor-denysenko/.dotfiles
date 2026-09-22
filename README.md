# dotfiles

Managed by [chezmoi](https://www.chezmoi.io/).

## Install on Linux

### Prerequisites

| Tool | Needed for |
|------|-----------|
| `git`, `curl` | cloning this repo, downloads |
| `zsh` | becomes your login shell after install |
| [chezmoi](https://www.chezmoi.io/) 2.x | applies these dotfiles |

```sh
# Debian/Ubuntu
sudo apt update && sudo apt install -y git curl zsh

# Fedora
sudo dnf install -y git curl zsh

# Arch (chezmoi is in extra: sudo pacman -S chezmoi)
sudo pacman -S --needed git curl zsh

# Alpine
sudo apk add git curl zsh

# chezmoi — any distro
sh -c "$(curl -fsLS get.chezmoi.io)"
```

Optional tools — configs degrade gracefully without them: `neovim`, `starship`, `fzf`, `ripgrep`, `git-delta`,
`zellij`/`tmux`, `fnm`/`pnpm` (needed by `vendor-skills.sh`), and `opencode` or `pi` (read `~/.agents/skills/`).

### Setup

```sh
chezmoi init https://github.com/egor-denysenko/.dotfiles.git && chezmoi apply -v
~/.local/share/chezmoi/scripts/install-skills.sh   # flatten skills into ~/.agents/skills/
chsh -s "$(command -v zsh)"                        # make zsh the login shell
```

`chezmoi init` prompts for `machine` (`personal` / `work` — `work` leaves `~/.gitconfig` locally managed) and `theme`
(`dark` default / `light`), persisted in `~/.config/chezmoi/chezmoi.toml`. Skip both prompts non-interactively by
pre-seeding the answers before `init`:

```sh
mkdir -p ~/.config/chezmoi
printf '[data]\nmachine = "personal"\ntheme = "dark"\n' > ~/.config/chezmoi/chezmoi.toml
```

Re-run `chezmoi apply -v` after pulling repo changes; `run_once_` scripts only execute on the first apply.
Sway/WezTerm/Ghostty configs are skipped by default (headless-friendly) — see `.chezmoiignore`.

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
