# Scripts

## Skills Structure

All skills live in `dot_agents/skills/`, managed by chezmoi and synced to `~/.agents/skills/`. The tree is split:

- `dot_agents/skills/personal/<name>/` — hand-written, not vendored
- `dot_agents/skills/vendored/<name>/` — pulled by `vendor-skills.sh`; each contains a `dot_vendored-version` marker (`<source>@<ref>`)

Both opencode and pi recurse under `~/.agents/skills/`, so the split is purely organizational — discovery still works.

## install-skills.sh

Copies skills from the chezmoi source to `~/.agents/skills/`.

```bash
./scripts/install-skills.sh
```

## vendor-skills.sh

Vendors third-party skills into `dot_agents/skills/` using the `skills` CLI.
YAML parsing is done via `chezmoi execute-template` (no `yq` required).

### Prerequisites

- `skills` CLI installed: `npm install -g skills`
- `chezmoi` installed (already a hard dep of this repo)

### Usage

```bash
./scripts/vendor-skills.sh            # vendor everything in YAML
./scripts/vendor-skills.sh --dry-run  # print planned actions, write nothing
```

Reads pinned sources from `.chezmoidata/third_party_skills.yaml` (under
the `third_party_skills:` key).

### Pinning

- **With tags**: `ref: skill-v3.1.1`
- **Without tags**: `ref: <commit-hash>`

### Upgrade workflow

```bash
$EDITOR .chezmoidata/third_party_skills.yaml  # change ref
./scripts/vendor-skills.sh
git add .chezmoidata/third_party_skills.yaml dot_agents/skills/
git commit -m "Upgrade third-party skills"
chezmoi apply
```

## run_once scripts

Scripts prefixed with `executable_run_once_` in `dot_config/scripts/` are deployed to `~/.config/scripts/` and run once on `chezmoi apply`. Chezmoi tracks execution state — they won't re-run unless you clear `~/.local/share/chezmoi/run_once/`.

| Script | Purpose |
|--------|---------|
| `executable_run_once_ensure_agents_skills_dir.sh` | Creates `~/.agents/skills/` |
| `executable_run_once_symlink_pi_skills.sh` | Symlinks `~/.pi/agent/skills/` → `~/.agents/skills/` |
| `executable_run_once_patch_pi_offline_export.sh` | Patches pi-coding-agent's export-html to include system prompt snapshots |

---

**Rules:**
- When adding or moving scripts, update this file.
