---
name: agents-md
description: Create or optimize an AGENTS.md file for any project repository following the open standard (https://agents.md). Analyzes codebase structure, tech stack, build system, and conventions to produce a minimal, focused AGENTS.md with progressive disclosure. Handles monorepos with nested AGENTS.md files. Use when user says "create AGENTS.md", "add AGENTS.md", "fix my AGENTS.md", "optimize AGENTS.md", "refactor AGENTS.md", or asks to make a repo AI-agent-friendly.
---

# AGENTS.md Skill

## Workflow

### 1. Analyze the project

- Detect: language(s), package manager, build tool, test framework, linter/formatter
- Read: README.md, package.json / go.mod / pyproject.toml / Cargo.toml / etc.
- Check: is this a monorepo? (workspaces, multiple go.mod, Nx, Turborepo, Lerna, mani)
- Check: does AGENTS.md already exist? If yes → optimize path (see step 5)

### 2. Determine root AGENTS.md content

Include ONLY what's relevant to every task in the repo:

- **One-sentence project description** (what + why)
- **Package manager** (if not the language default)
- **Build/test/lint commands** (if non-standard)
- **Architecture boundaries** (if multi-component)
- **Domain terminology** (if ambiguous terms exist)
- **References to supplementary docs** (progressive disclosure)

Do NOT include: obvious things the agent already knows, language tutorials, file paths that will go stale, style rules that belong in linter config.

### 3. Create supplementary docs (progressive disclosure)

If domain-specific rules exceed 10 lines, move them to separate files. Confirm path with user before writing. Common splits:

- `docs/CODING_CONVENTIONS.md` — language-specific style rules
- `docs/TESTING.md` — test patterns, fixtures, mocking strategy
- `docs/ARCHITECTURE.md` — component boundaries, data flow
- `docs/API_DESIGN.md` — endpoint conventions, versioning

Ask user: "I'll place supplementary docs at `docs/<NAME>.md` — does that path work for you, or do you prefer a different location?"

### 4. Handle monorepos

If monorepo detected, ask user: "This is a monorepo. Would you like AGENTS.md files for subpackages too?"

If yes:
- Root AGENTS.md: monorepo purpose, navigation hints, shared tooling
- Package AGENTS.md: package purpose, package-specific stack, local conventions
- Keep each level focused — don't repeat root info in subpackages

### 5. Optimize existing AGENTS.md

If AGENTS.md already exists:

1. **Find contradictions** — flag conflicting instructions, ask user which to keep
2. **Identify bloat** — rules the agent already knows, vague instructions, stale file paths
3. **Extract essentials** — what truly belongs at root level
4. **Propose splits** — group remaining content into progressive disclosure files
5. **Flag for deletion** — redundant, too vague, or overly obvious entries
6. Present refactored version for user approval before writing

### 6. Validate

After writing, verify against checklist:

- [ ] Under 150 actionable instructions at root level
- [ ] No stale file paths (describe capabilities, not locations)
- [ ] Progressive disclosure used for domain-specific rules
- [ ] No redundancy with linter/formatter config
- [ ] Monorepo: each level scoped appropriately

## Key Principles

See [REFERENCE.md](REFERENCE.md) for the full best-practice guide and the official spec.
See [EXAMPLES.md](EXAMPLES.md) for sample outputs by project type.
