# AGENTS.md Reference Guide

## The Official Spec

AGENTS.md is an open standard (https://agents.md) supported by 20+ tools including OpenAI Codex, Cursor, VS Code, Windsurf, Devin, GitHub Copilot coding agent, Jules, Aider, opencode, Zed, and more. It is stewarded by the Agentic AI Foundation under the Linux Foundation.

Key spec points:
- Standard Markdown, no required fields
- Closest AGENTS.md to the edited file wins (for nested files)
- Explicit user chat prompts override everything
- The agent will attempt to execute commands listed in the file
- Living documentation — update it freely

## The Instruction Budget

Frontier thinking LLMs can follow ~150-200 instructions with reasonable consistency. Smaller models fewer. Every token in AGENTS.md loads on EVERY request regardless of relevance. This creates a hard budget:

| Scenario | Impact |
|----------|--------|
| Small, focused file | More tokens for task-specific work |
| Large, bloated file | Fewer tokens for real work; agent confused |
| Irrelevant instructions | Token waste + distraction = worse output |

**The ideal AGENTS.md is as small as possible.**

## What Belongs at Root Level

The absolute minimum that earns its token cost:

1. **One-sentence project description** — anchors every decision the agent makes
2. **Package manager** — only if not the language default (e.g., pnpm instead of npm)
3. **Build/test/lint commands** — only if non-standard or non-discoverable
4. **Architecture boundaries** — high-level component relationships
5. **Domain terminology** — terms that could be ambiguous (e.g., "organization" vs "workspace" vs "team")
6. **Security considerations** — things the agent must never do
7. **References** — pointers to progressive disclosure docs

## What Does NOT Belong in AGENTS.md

- Things the agent already knows (language syntax, common patterns)
- File structure documentation (paths go stale; describe capabilities instead)
- Detailed coding style rules (use linter config files)
- Large reference tables or data schemas
- Tutorials or explanations aimed at humans
- Obvious instructions ("write clean code", "handle errors")
- Auto-generated comprehensive dumps

## Anti-Patterns

### The Ball of Mud
Symptoms: 500+ lines, contradicting rules added by different developers over months, no structure.
Fix: Extract essentials, split by domain into separate files, delete redundant entries.

### Stale File Paths
Symptoms: "Authentication lives in `src/auth/handlers.ts`" but the file was renamed 3 months ago.
Fix: Describe capabilities ("authentication is handled by the auth module") not locations. Let the agent search.

### The Auto-Generated Dump
Symptoms: Initialization script produced a "comprehensive" file that documents everything "useful for most scenarios."
Fix: Delete 80% of it. Keep only what's relevant to every task.

### Conflicting Instructions
Symptoms: "Always use interfaces" + "Prefer type aliases for unions" + "Use classes for DI" — the agent doesn't know which to follow.
Fix: Identify contradictions, pick one winner per domain, document the decision.

### Redundancy with Tooling
Symptoms: AGENTS.md says "use single quotes, no semicolons" but `.eslintrc` already enforces this.
Fix: Delete from AGENTS.md. The linter output tells the agent what it needs.

## Progressive Disclosure Strategy

Instead of cramming everything into one file, create a discoverable tree:

```
project/
├── AGENTS.md                  # Minimal root (essentials only)
├── docs/
│   ├── CODING_CONVENTIONS.md  # Language-specific rules
│   ├── TESTING.md             # Test patterns and frameworks
│   ├── ARCHITECTURE.md        # System design, boundaries
│   └── API_DESIGN.md          # Endpoint conventions
```

In root AGENTS.md, reference them conversationally:

```markdown
For TypeScript conventions, see docs/CODING_CONVENTIONS.md
For testing patterns, see docs/TESTING.md
```

Benefits:
- Domain-specific rules only load when the agent works in that area
- Other tasks don't waste tokens on irrelevant context
- Each file stays focused and maintainable

## Monorepo Strategy

| Level | Content |
|-------|---------|
| Root | Monorepo purpose, how to navigate packages, shared tools |
| Package | Package purpose, specific tech stack, local conventions |

Root should NOT repeat what's in subpackages. Subpackages should NOT repeat what's in root.

Each level answers: "What does an agent need to know when working HERE specifically?"

## Describing vs. Documenting

**Bad** (documenting structure — will go stale):
```markdown
## Project Structure
- src/auth/handlers.ts — authentication endpoints
- src/auth/middleware.ts — JWT validation
- src/db/migrations/ — database migrations
```

**Good** (describing capabilities — stable):
```markdown
Authentication uses JWT with refresh tokens.
Database migrations are managed by Prisma.
```

The agent can grep/glob to find files. It cannot infer architectural intent from file names alone. Document intent, not locations.

## Section Templates

### For a backend service:
```markdown
## Setup
- Install: `<command>`
- Dev server: `<command>`
- Tests: `<command>`

## Architecture
[One paragraph: what the service does, its boundaries, key integrations]

## Conventions
[Only rules NOT enforceable by linter/formatter]
```

### For a library:
```markdown
## Setup
- Install: `<command>`
- Tests: `<command>`
- Build: `<command>`

## Public API
[Design principles for the public surface]

## Conventions
[Naming patterns, export rules, documentation requirements]
```

### For a CLI tool:
```markdown
## Setup
- Build: `<command>`
- Tests: `<command>`

## Command structure
[How commands are organized, naming conventions]

## Conventions
[Error handling patterns, output formatting]
```

## CLAUDE.md Compatibility

Claude Code uses `CLAUDE.md` instead of `AGENTS.md`. If the user needs both, suggest a symlink:

```bash
ln -s AGENTS.md CLAUDE.md
```

Do NOT create the symlink automatically — only suggest it if the user asks about Claude Code compatibility.
