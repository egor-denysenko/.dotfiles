---
name: agents-md
description: Create/optimize AGENTS.md per https://agents.md. Analyze codebase, stack, conventions. Minimal w/ progressive disclosure. Handles monorepos. Trigger: "create AGENTS.md", "add AGENTS.md", "optimize AGENTS.md", "refactor AGENTS.md", "make repo AI-friendly".
---

## Workflow

### 1. Analyze project
- Detect: language, pkg manager, build tool, test framework, linter from config files
- Read: README.md, package.json / go.mod / pyproject.toml / Cargo.toml
- Monorepo? (workspaces, go.mod, Nx, Turborepo, Lerna)
- AGENTS.md exists? If yes → optimize (step 5)

### 2. Root AGENTS.md content
- One-sentence project description (what + why)
- Package manager (if not language default, e.g. yarn not npm)
- Build/test/lint commands (if not framework default)
- Architecture boundaries (if multi-component)
- Domain terminology (if ambiguous)
- References to supplementary docs (progressive disclosure)

Omit: obvious, tutorials, stale paths, linter rules.

### 3. Supplementary docs (progressive disclosure)
Domain rules >10 lines → separate file. Confirm path. Common docs:
- `docs/CODING_CONVENTIONS.md` — style rules
- `docs/TESTING.md` — test patterns, mocking
- `docs/ARCHITECTURE.md` — boundaries, data flow
- `docs/API_DESIGN.md` — endpoint conventions

Ask user: "Place at `docs/<NAME>.md` — path OK?"

### 4. Monorepos
If monorepo: ask "AGENTS.md for subpackages?"
- Root: purpose, navigation, shared tooling
- Package: purpose, local stack + conventions
- No repeat root info

### 5. Optimize existing
If AGENTS.md exists:
1. Find contradictions — conflicting instructions. Ask user to resolve.
2. Identify bloat — known rules, vague, stale paths
3. Extract essentials — root-level only
4. Propose splits → progressive disclosure files
5. Flag deletions — redundant, vague, obvious

Get approval before writing.

### 6. Validate
After writing:
- [ ] Under 150 actionable instructions at root
- [ ] No stale paths (describe capabilities, not locations)
- [ ] Progressive disclosure used
- [ ] No redundancy with linter config
- [ ] Monorepo: each level scoped

## Key Principles
See REFERENCE.md for full guide + spec.
See EXAMPLES.md for sample outputs by project type.
