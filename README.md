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

Optional tools — configs degrade gracefully without them: `neovim`, `starship`, `fzf`, `ripgrep`, `git-delta`, `btop`,
`zellij`/`tmux`, `fnm`/`pnpm` (needed by `vendor-skills.sh`), and `opencode` or `pi` (read `~/.agents/skills/`).

### Setup

```sh
# GitHub's default branch is `chezmoi` (older state) — --branch pins this work;
# drop it once this branch becomes the default.
chezmoi init --branch opencode-v2-and-docs https://github.com/egor-denysenko/.dotfiles.git && chezmoi apply -v
~/.local/share/chezmoi/scripts/install-skills.sh   # flatten skills into ~/.agents/skills/
chsh -s "$(command -v zsh)"                        # make zsh the login shell
```

`chezmoi init` prompts for `machine` (`personal` / `work` — `work` leaves `~/.gitconfig` locally managed), `theme`
(`dark` default / `light`), `gui` (deploys GUI configs: Sway/WezTerm/Ghostty/Rofi/GTK/Waybar — answer **`y` or `n`**,
also accepts `yes/no/true/false/1/0`, `Enter` = yes; `n` on headless boxes), and `kbd` (keyboard layout XKB code(s),
comma-separable — the prompt shows the full list and defaults to the system's current layout), persisted in
`~/.config/chezmoi/chezmoi.toml`. Skip all four prompts non-interactively by pre-seeding the answers before `init`:

```sh
mkdir -p ~/.config/chezmoi
printf '[data]\nmachine = "personal"\ntheme = "dark"\ngui = true\nkbd = "it"\n' > ~/.config/chezmoi/chezmoi.toml
```

Re-run `chezmoi apply -v` after pulling repo changes; `run_once_` scripts only execute on the first apply.
Sway/WezTerm/Ghostty/Rofi/GTK/Waybar configs and the cursor theme are only deployed when `gui` is truthy — see
`.chezmoiignore`. If `gui` came out falsy or is missing, everything under `.config/sway/` (wallpaper included) is
skipped: set `gui = true` under `[data]` in `~/.config/chezmoi/chezmoi.toml` and re-run `chezmoi apply -v`.
Change the keyboard layout later with `~/.config/scripts/pick-kbd.sh` (list picker: rofi → fzf → printed list; also
bound to `$mod+Shift+p` inside sway).

## Sway session dependencies

Chezmoi ships the Sway config but installs no packages. Missing dependencies degrade gracefully (binding dead /
feature skipped) except where noted:

| Dependency | Needed for |
|------------|-----------|
| `sway` (+ `swaymsg`, `swaynag`, `swaybg`) | compositor; **config fails to load** if the wallpaper file in `dot_config/sway/backgrounds/` is missing |
| `swayidle`, `swaylock` | idle timeouts → lock/blank, lock before sleep, `$mod+Shift+i` |
| `rofi` with Wayland support | launcher (`$mod+d`) + calc menu (`$mod+c`) + layout picker (`$mod+Shift+p`, with `fzf` fallback); Fedora ships it as `rofi` ≥ 2.0, other distros: the `rofi-wayland` build; warm-burnout-dark + gruvbox themes (and their shared layout) are vendored in `dot_config/rofi/themes/`, so no distro theme package is needed |
| `qalc` (package `qalculate`) | calculator backend for rofi's calc mode |
| `waybar` + fonts `Font Awesome 6`, `Noto Sans Mono` | status bar — enabled by the vendored `config.d/90-bar.conf`, config vendored in `dot_config/waybar/` (missing fonts = tofu icons) |
| `wezterm`, `firefox` | `$term` / `$browser` — change the `set` lines in `dot_config/sway/config` if you use others |
| `pactl` (+ optional `notify-send`) | volume keys — vendored `config.d/60-bindings-volume.conf` + `dot_config/sway/scripts/volume-helper` |
| `brightnessctl` (+ optional `notify-send`) | brightness keys — vendored `config.d/60-bindings-brightness.conf` |
| `playerctl` | media keys — vendored `config.d/60-bindings-media.conf` |
| `grimshot` (+ `grim`, `slurp`) | screenshot keys — vendored `config.d/60-bindings-screenshot.conf` |
| `lxqt-policykit` or `polkit-gnome` | privilege-request auth agent autostart (vendored `95-autostart-policykit-agent.conf`) |
| `sway-systemd`, `xdg-user-dirs` | dbus/session env propagation, cgroup + xdg-autostart integration, user dirs (vendored `10-systemd-*` / `95-xdg-*`; no-op when missing) |
| `gsettings` (glib2) | dark-scheme hint for GTK apps (optional) |
| `systemctl` (systemd) | hibernation binding (optional; needs swap) |

Session glue (bar, bindings, window rules, autostart, systemd integration) is **vendored** into
`dot_config/sway/config.d/` — every distro gets the same session, and each file documents its `Requires:` and no-ops
without it. On Fedora, layered-include merges by basename, so our copies (e.g. `90-swayidle.conf`, `90-bar.conf`)
replace the distro's originals — no duplicates. Per-machine extras: any extra `*.conf` in `~/.config/sway/config.d/`.

## Structure

| Path | Manages |
|------|---------|
| `dot_config/zsh` | Zsh + Zim, fzf, aliases |
| `dot_config/nvim` | Neovim (LazyVim-based) |
| `dot_config/sway` | Sway WM (config + keybindings; vendored session glue in `config.d/`, `volume-helper` in `scripts/`; wallpaper in `backgrounds/`) |
| `dot_config/wezterm` | WezTerm terminal |
| `dot_config/ghostty` | Ghostty terminal themes |
| `dot_config/rofi` | Rofi launcher (warm-burnout-dark + gruvbox themes, shared layout, all vendored in `themes/`) |
| `dot_config/gtk-3.0` | GTK dark-mode + Banana-Red cursor preference |
| `dot_config/waybar` | Waybar status bar (config + style vendored from distro defaults) |
| `dot_config/btop` | btop system monitor (adwaita-dark theme vendored in `themes/`) |
| `dot_local/share/icons` | Banana-Red cursor theme (~28 MB of XCursor files) |
| `dot_config/zellij` | Zellij multiplexer |
| `dot_config/starship` | Starship prompt |
| `dot_config/scripts` | Utility scripts (`pick-kbd.sh` layout picker, `betterGitBranch.sh`, ...) |
| `dot_config/pi/agent` | Pi coding agent config (extensions, themes, models) |
| `dot_config/opencode` | OpenCode v2 config: `agents/` (ask, debug), `commands/` (mozzarella) |
| `dot_agents/skills` | Agent skills (synced to `~/.agents/skills/`; pi gets them via a symlink in `~/.pi/agent/skills/`) |

## Templates

Uses `.chezmoi.toml.tmpl` for machine-type (personal/work), theme (dark/light), gui, and keyboard layout (`kbd`) data.

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
