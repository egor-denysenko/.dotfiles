# Scripts

## Skills Structure

All skills live in `dot_agents/skills/`, managed by chezmoi and synced to `~/.agents/skills/`.

## install-skills.sh

Copies skills from the chezmoi source to `~/.agents/skills/`.

```bash
./scripts/install-skills.sh
```

## vendor-skills.sh

Vendors third-party skills into `dot_agents/skills/` using `npx skills add`.

### Prerequisites

- `skills` CLI installed: `npm install -g skills`
- `yq` installed

### Usage

```bash
./scripts/vendor-skills.sh
```

Reads pinned sources from `.chezmoidata/third_party_skills.yaml`.

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
