# AGENTS.md Examples

## Go Backend Service

```markdown
# AGENTS.md

REST API service for user management, built with Go and Chi router.

## Setup

- Build: `make build`
- Test: `make test`
- Lint: `golangci-lint run ./...`
- Dev server: `make run` (requires PostgreSQL on localhost:5432)

## Architecture

HTTP handlers delegate to service layer; service layer owns business logic and talks to repository layer for persistence. No database calls in handlers.

## Conventions

- Error handling: wrap with context using `fmt.Errorf("doing X: %w", err)`
- Config: loaded from environment variables via `internal/config`
- Migrations: managed by golang-migrate, run `make migrate-up`

For API design patterns, see docs/API_DESIGN.md
For testing patterns, see docs/TESTING.md
```

## Node.js/TypeScript Monorepo (pnpm workspaces)

Root `AGENTS.md`:

```markdown
# AGENTS.md

E-commerce platform monorepo with React frontend, Node.js API, and shared packages.

This project uses pnpm workspaces.

## Setup

- Install: `pnpm install`
- Build all: `pnpm -r build`
- Test all: `pnpm -r test`
- Lint: `pnpm -r lint`

## Navigation

- `packages/api/` — Express REST API (see its AGENTS.md)
- `packages/web/` — React SPA (see its AGENTS.md)
- `packages/shared/` — shared types and utilities

## Conventions

- Shared types go in `packages/shared`, never duplicated
- Each package manages its own dependencies
- Cross-package imports use workspace protocol (`workspace:*`)
```

Subpackage `packages/api/AGENTS.md`:

```markdown
# AGENTS.md

Express REST API with Prisma ORM and PostgreSQL.

## Setup

- Dev: `pnpm dev` (hot reload)
- Test: `pnpm test` (uses Vitest + testcontainers)
- Generate Prisma client: `pnpm prisma generate`

## Conventions

- Controllers validate input with Zod, delegate to services
- Services contain business logic, never import Express types
- Database access only through Prisma repositories

For error handling patterns, see docs/ERRORS.md
```

## Python Data Science Project

```markdown
# AGENTS.md

ML pipeline for customer churn prediction. Python 3.11+, managed with uv.

## Setup

- Install: `uv sync`
- Test: `uv run pytest`
- Lint: `uv run ruff check .`
- Format: `uv run ruff format .`
- Train model: `uv run python -m src.train`

## Architecture

Pipeline stages: ingestion -> feature engineering -> training -> evaluation.
Each stage is a standalone module under `src/stages/`.

## Conventions

- Type hints on all public functions
- Dataframes: use polars, not pandas
- Config: Hydra configs under `conf/`
- Experiments tracked in MLflow (local server at localhost:5000)

## Security

- Never commit model artifacts or data files
- Never log PII fields; use the sanitizer in `src/utils/privacy.py`
```

## Rust CLI Tool

```markdown
# AGENTS.md

CLI tool for managing cloud infrastructure state, written in Rust.

## Setup

- Build: `cargo build`
- Test: `cargo test`
- Lint: `cargo clippy -- -D warnings`
- Format: `cargo fmt`
- Run: `cargo run -- <args>`

## Conventions

- Use `anyhow` for application errors, `thiserror` for library errors
- CLI parsing with `clap` derive macros
- Prefer exhaustive `match` — avoid wildcard arms
- Integration tests go in `tests/` (top-level), unit tests inline

## Architecture

Commands are defined in `src/commands/`, each as a separate module.
Core logic lives in `src/engine/` and is CLI-agnostic (testable without clap).
```

## React Component Library

```markdown
# AGENTS.md

Accessible React component library for design system. TypeScript, Vite, Storybook.

## Setup

- Install: `pnpm install`
- Dev (Storybook): `pnpm storybook`
- Test: `pnpm test`
- Build: `pnpm build`
- Lint: `pnpm lint`

## Conventions

- Every component must pass axe accessibility checks
- Export components from `src/index.ts` (barrel file)
- Props interfaces named `<Component>Props`
- Use CSS Modules for styling (no runtime CSS-in-JS)

For accessibility patterns, see docs/A11Y.md
For component API design, see docs/COMPONENT_API.md
```

## Optimized Result (Before/After)

### Before (bloated, 200+ lines):

```markdown
# AGENTS.md

## About This Project
This is a Next.js application that serves as our company's main website...
[3 paragraphs of history nobody needs]

## File Structure
- src/app/ — Next.js app router pages
- src/components/ — React components
- src/lib/ — utility functions
- src/styles/ — CSS modules
[30 more lines of file paths]

## Code Style
- Use const instead of let
- Use arrow functions
- Use interfaces not types
- Single quotes
- No semicolons
- 2 space indent
[all already in .eslintrc and .prettierrc]

## Git
- Use conventional commits
- Branch from main
- Squash merge
[obvious workflow most agents default to]
...
```

### After (focused, 25 lines):

```markdown
# AGENTS.md

Marketing website with CMS integration. Next.js 14 (app router), TypeScript, pnpm.

## Setup

- Install: `pnpm install`
- Dev: `pnpm dev`
- Test: `pnpm test`
- Lint + format: `pnpm check` (runs ESLint + Prettier)
- Build: `pnpm build`

## Architecture

Pages fetch content from Sanity CMS at build time (ISR, 60s revalidation).
Dynamic routes use `generateStaticParams`. No client-side data fetching except search.

## Conventions

- Images: use `next/image` with Sanity image loader
- CMS queries: colocate GROQ queries in the page/component that uses them
- New pages: add to sitemap generator in `src/app/sitemap.ts`

For CMS schema patterns, see docs/CMS.md
```
