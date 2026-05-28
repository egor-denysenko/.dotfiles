# Scripts

## Skills Structure

- `dot_agents/personal_skills/` - Owned skills (tracked in git)
- `dot_agents/external_skills/` - Vendored third-party skills (managed by vendor script)

## install-skills.sh

Copies skills from both source directories to `~/.agents/skills/`.

```bash
./scripts/install-skills.sh
```

## vendor-skills.sh

Vendors third-party skills into `dot_agents/external_skills/` using `npx skills add`.

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
git add .chezmoidata/third_party_skills.yaml dot_agents/external_skills/
git commit -m "Upgrade third-party skills"
chezmoi apply
```
