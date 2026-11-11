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
| `dot_config/pig/agent` | Separate PiG config, UI extensions, theme, and keybindings |
| `dot_agents/skills` | Agent skills (synced to `~/.agents/skills/`; pi gets them via a symlink in `~/.pi/agent/skills/`) |

## PiG UI configuration

Zsh exports `PIG_HOME=$HOME/.config/pig`; settings live in
`~/.config/pig/agent/settings.json`. Pi remains independent. Existing PiG
credentials and sessions were copied from `~/.pig/agent`; the old directory is
kept untouched as a backup (a session already running there continues using it).
New machines need their own `pig login`; credentials and sessions are not tracked.

The six local UI extensions run through PiG's supported Node/TypeScript
compatibility runtime (Node must be on PATH):

- **startup-banner**: sheriff “Pig Is Fine” artwork and startup resource inventory in a
  widget, leaving PiG's native mascot header intact. `/startup` toggles the
  widget; it hides automatically on the first prompt to reclaim editor space.
  `quietStartup` is deliberately false so the mascot is visible. `/sprite`
  selects the pig; `/sprite preview` shows its full artwork.
- **vision-status**: usage/model footer with image-input capability indicator.
- **context-size**: one approximate prompt/tool-schema overhead notice per session.
- **stash-prompt**: Ctrl+S stashes a draft; on an empty editor it restores the
  latest stash. `/stashes` opens the picker. Stashes are in-memory, not persisted.
- **model-provider-filter**: Ctrl+L or `/provider-model` opens the provider-filtered
  picker; Tab/Shift+Tab changes provider, typing filters models. Ctrl+P and
  Ctrl+Shift+P cycle providers (models when only one provider is available).
  Unlike Pi's prototype patch, this uses a public custom component; PiG's stock
  `/model` selector stays available. The last chosen provider lives under
  `$PIG_HOME/state/ui/`, separate from Pi's temporary state.
- **notify**: completion notifications, `/notify-test`, `/notify-mute`, and
  `/notify-sound`. Desktop delivery uses `osascript` on macOS or `notify-send`
  on Linux, not OSC writes into a subprocess pipe. Sound is off by default;
  enabling it uses macOS Glass or Linux's `canberra-gtk-play` completion sound.
  Notification settings are in `extensions/ui-assets/notify.json`.

PiG uses the sheriff-pig-in-flames artwork below; Pi keeps its original
`thisisfine.sh` dog. Preview PiG's artwork independently:

```sh
~/.config/pig/agent/extensions/pig-is-fine.sh
~/.config/pig/agent/extensions/pig-is-fine.sh --color    # Force color when capturing output
~/.config/pig/agent/extensions/pig-is-fine.sh --no-color # Monochrome silhouette
```

Like `thisisfine.sh`, this is ANSI truecolor pixel art made from Unicode half
blocks (45 columns by 25 terminal rows), not line-drawn ASCII. Color stays on
when captured by a UI widget; `NO_COLOR` disables it. A UTF-8 terminal is needed.
The source is `dot_config/pig/agent/extensions/executable_pig-is-fine.sh`.
Regenerate its indexed pixel grid with `python3 scripts/pig-ui/generate-art.py`;
add `--preview /tmp/pig-is-fine.png` to inspect a PNG without extra dependencies.

The warm-burnout-dark theme is copied locally. Built-in selector save/sort keys
move from Ctrl+S to Alt+S, provider/path toggles from Ctrl+P to Alt+P, and the
labeled-tree filter from Ctrl+L to Alt+L to avoid extension shortcut conflicts.
Non-UI Pi tools, providers, npm packages, and prototype patches are not imported.

Apply and test:

```sh
chezmoi apply ~/.config/pig/agent ~/.config/zsh/.zshenv
node --test scripts/pig-ui/*.test.mjs
python3 scripts/pig-ui/smoke.py
PIG_HOME="$HOME/.config/pig" pig install --validate-only --json \
  ~/.config/pig/agent/extensions/*.ts
```

The smoke test opens a pseudo-terminal, tests provider tabs and stash/restore,
and resizes through 20/40/80/120 columns. It sends no model prompts or desktop
notifications. Launch a new shell, or run `export PIG_HOME=$HOME/.config/pig`,
then start `pig`. Use `/notify-test` to check OS notification permissions manually.

## Templates

Uses `.chezmoi.toml.tmpl` for machine-type (personal/work) and theme (dark/light) data.

## Local dictation (Fedora + Sway)

Hold **Super+Shift+V** to record, then release all three keys to transcribe locally and type into the focused field. The configuration uses Whisper `large-v3-turbo` on the AMD iGPU through Vulkan — enabled rootlessly with the `Environment=VOXTYPE_GPU=1` drop-in in `~/.config/systemd/user/voxtype.service.d/` — and `wtype` with clipboard fallback. Speech is transcribed in its original language, not translated. The language is pinned with **Super+Shift+l** or a click on the Waybar module (`~/.local/bin/voxtype-lang` cycles English → Italiano → auto); a pinned language skips Whisper's detection pass, which costs time and can misfire on short clips. `small`, `small.en`, and `base.en` remain available for comparison (`voxtype record start --model small`). Evdev hotkeys, cloud transcription, and automatic submission are disabled; no `input` group membership or `ydotool` is needed.

Install the latest stable [official Voxtype RPM](https://github.com/peteonrails/voxtype/releases/latest) with DNF after verifying its release signature. Fedora integration packages are `wtype`, `wl-clipboard`, `libnotify`, and `pipewire-alsa`. Chezmoi manages configuration only: it does not install packages, download models, or enable the service.

After applying the configuration on a new machine, download the models (the primary `large-v3-turbo` is about **1.6 GB**) and start the packaged user service:

```sh
voxtype setup --download --model large-v3-turbo --no-post-install
voxtype setup --download --model small --no-post-install  # optional fast path
voxtype setup check
systemctl --user start voxtype
```

**Automatic startup is deliberately disabled.** Start manually after login. Stop with `systemctl --user stop voxtype`; inspect logs with `journalctl --user -u voxtype -f`. The model stays loaded while the service runs; the microphone is captured only while recording. Models live in `~/.local/share/voxtype/models/`, outside this repository.

Waybar uses the official `voxtype status --follow --format json --extended` feed, filtered by the dependency-free Go helper in `scripts/voxtype-spinner/` (compiled to `~/.local/bin/voxtype-spinner` by `run_onchange_after_build-voxtype-spinner.sh.tmpl`; Go is required, binaries are not committed, and the `voxtype_spinner` data flag defaults to enabled). The module shows the pinned language as an emoji — 🔫 for English, 🍕 for Italiano, 🌍 for auto-detect — tinted green/peach/mauve by the language, and animates braille frames only while transcription runs. Clicking it cycles the pinned language through `voxtype-lang`, which refuses to switch mid-dictation instead of restarting the daemon and dropping the recording.

Managed files:

- `~/.config/voxtype/config.toml`
- `~/.config/sway/config.d/61-bindings-voxtype.conf`
- `~/.config/waybar/config.jsonc` and `style.css`
- `~/.local/bin/voxtype-lang` (language switcher, bash)
- `~/.local/bin/voxtype-spinner` (Waybar filter, Go — built, not tracked)

Edit the configuration through `chezmoi edit --apply ~/.config/voxtype/config.toml`, then restart Voxtype. To switch models through its CLI while keeping chezmoi in sync:

```sh
voxtype config set whisper.model small  # or base.en / small.en
chezmoi add ~/.config/voxtype/config.toml
systemctl --user restart voxtype
```

After editing the binding, validate with `sway --validate --config ~/.config/sway/config` before `swaymsg reload`. Reload Waybar with `pkill -USR2 -x waybar`. Check the selected model/backend with `voxtype status --format json --extended`.

### DJI remote dictation (Sway)

On this laptop, `[data] dji_dictation = true` in the local `~/.config/chezmoi/chezmoi.toml` enables `62-bindings-dji-dictation.conf`. The option defaults to disabled on other machines. A dependency-free Go helper implements the immediate recording toggle; install Go (`sudo dnf install golang` on Fedora) before applying. Chezmoi's `run_onchange_after_build-dji-dictation.sh.tmpl` tests and compiles the source in `scripts/dji-dictation/` to `~/.local/bin/dji-dictation` when it changes. No prebuilt binary is tracked. Apply with `chezmoi apply ~/.config/sway/config.d/62-bindings-dji-dictation.conf`, validate the Sway config, and reload Sway.

A single tap of the DJI transmitter's pair button sends USB `KEY_VOLUMEUP`, remapped to `F20` by the receiver-specific `dji-dictation.xkb` keymap: tap once to start dictation, again to stop and transcribe into the focused application. Only the DJI receiver's Consumer Control device is remapped and bound; other volume keys keep their normal function. Voxtype must be running. Each click immediately toggles recording while Voxtype is idle or recording; clicks are ignored while transcribing or stopped. There is no Enter/submission action. Avoid double-clicking or holding the DJI link button: its firmware handles connection-mode/pairing gestures independently of Linux. The power button controls internal recording, so it is not used for dictation. The binding is disabled while the screen is locked and does not change the button's internal DJI behavior.

### Dictation follow-ups

- [ ] Add a separate keyboard/clicker button for explicit Enter/submission; do not reuse DJI firmware gestures.
- [ ] Add text-to-speech playback through Bluetooth earbuds, keeping the DJI receiver selected as the microphone.

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
