# dotfiles

Managed by [chezmoi](https://www.chezmoi.io/).

## Quick setup on a new machine

```sh
chezmoi init https://github.com/egor-denysenko/dotfiles.git && chezmoi apply -v
```

## Structure

| Path | Manages |
|------|---------|
| `dot_config/zsh` | Zsh + Zim, fzf, aliases |
| `dot_config/nvim` | Neovim (LazyVim-based) |
| `dot_config/sway` | Sway WM |
| `dot_config/wezterm` | WezTerm terminal |
| `dot_config/zellij` | Zellij multiplexer |
| `dot_config/starship` | Starship prompt |
| `dot_config/scripts` | Utility scripts |
| `dot_config/pi/agent` | Pi coding agent config (extensions, themes, models) |
| `dot_agents/skills` | Agent skills (synced to `~/.agents/skills/`; pi gets them via a symlink in `~/.pi/agent/skills/`) |

## Templates

Uses `.chezmoi.toml.tmpl` for machine-type (personal/work) and theme (dark/light) data.
