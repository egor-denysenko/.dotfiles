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
| `dot_config/sway` | Sway WM + push-to-talk dictation binding |
| `dot_config/voxtype` | Local Whisper dictation configuration |
| `dot_config/waybar` | Waybar layout, styling, and animated dictation indicator |
| `dot_config/wezterm` | WezTerm terminal |
| `dot_config/zellij` | Zellij multiplexer |
| `dot_config/starship` | Starship prompt |
| `dot_config/scripts` | Utility scripts |
| `dot_config/pi/agent` | Pi coding agent config (extensions, themes, models) |
| `dot_agents/skills` | Agent skills (synced to `~/.agents/skills/`; pi gets them via a symlink in `~/.pi/agent/skills/`) |

## Templates

Uses `.chezmoi.toml.tmpl` for machine-type (personal/work) and theme (dark/light) data.

## Local dictation (Fedora + Sway)

Hold **Super+Shift+V** to record, then release all three keys to transcribe locally and type into the focused field. The configuration uses multilingual Whisper `small` on CPU, automatic language detection (`language = "auto"`) for English/Italian dictation, and `wtype` with clipboard fallback. Speech is transcribed in its original language, not translated. `base.en` and `small.en` remain available for comparison. Evdev hotkeys, cloud transcription, and automatic submission are disabled; no `input` group membership or `ydotool` is needed.

Install the latest stable [official Voxtype RPM](https://github.com/peteonrails/voxtype/releases/latest) with DNF after verifying its release signature. Fedora integration packages are `wtype`, `wl-clipboard`, `libnotify`, and `pipewire-alsa`. Chezmoi manages configuration only: it does not install packages, download models, or enable the service.

After applying the configuration on a new machine, download the three models (about **1.1 GB total**) and start the packaged user service:

```sh
voxtype setup --download --model base.en --no-post-install
voxtype setup --download --model small.en --no-post-install
voxtype setup --download --model small --no-post-install
voxtype setup check
systemctl --user start voxtype
```

**Automatic startup is deliberately disabled.** Start manually after login. Stop with `systemctl --user stop voxtype`; inspect logs with `journalctl --user -u voxtype -f`. The model stays loaded while the service runs; the microphone is captured only while recording. Models live in `~/.local/share/voxtype/models/`, outside this repository.

Waybar uses the official `voxtype status --follow --format json --extended` feed, with `scripts/voxtype-spinner.py` adding animation only during transcription. The indicator is a grey microphone when ready, yellow when recording, an animated spinner while transcribing, and a slashed microphone when the daemon is stopped. Clicking the microphone toggles a pink background for fun; it does not record or change language. This cosmetic state is stored in `$XDG_RUNTIME_DIR/waybar-voxtype-pink` and resets after logout.

Managed files:

- `~/.config/voxtype/config.toml`
- `~/.config/sway/config.d/61-bindings-voxtype.conf`
- `~/.config/waybar/config.jsonc` and `style.css`
- `~/.config/waybar/scripts/voxtype-spinner.py`

Edit the configuration through `chezmoi edit --apply ~/.config/voxtype/config.toml`, then restart Voxtype. To switch models through its CLI while keeping chezmoi in sync:

```sh
voxtype config set whisper.model small  # or base.en / small.en
chezmoi add ~/.config/voxtype/config.toml
systemctl --user restart voxtype
```

After editing the binding, validate with `sway --validate --config ~/.config/sway/config` before `swaymsg reload`. Reload Waybar with `pkill -USR2 -x waybar`. Check the selected model/backend with `voxtype status --format json --extended`.

## Updating skills

Layout: `dot_agents/skills/personal/<name>/` (hand-written) and `dot_agents/skills/vendored/<name>/` (pulled from upstream). Both opencode and pi recurse, so the split is just organization.

### Add or bump a vendored skill

1. Edit `.chezmoidata/third_party_skills.yaml` — add a group or change a `ref:` (tag or commit SHA, both work).
2. Dry-run: `./scripts/vendor-skills.sh --dry-run`
3. Apply: `./scripts/vendor-skills.sh`
4. `chezmoi apply` to push to `~/.agents/skills/`
5. Commit `.chezmoidata/third_party_skills.yaml` + `dot_agents/skills/vendored/`

Script uses `pnpm dlx skills` under the hood. Strips `README.md` from each vendored skill, writes `dot_vendored-version: <source>@<ref>` marker.

### Add a personal skill

`mkdir dot_agents/skills/personal/<name>/`, drop `SKILL.md` with `name:` + `description:` frontmatter, `chezmoi apply`. No script needed.
