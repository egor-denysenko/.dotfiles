# Chezmoi Dotfiles

Dotfiles managed by chezmoi. Scripts prefixed `executable_run_once_` run once on `chezmoi apply`; `executable_` makes them executable.

See [`scripts/AGENTS.md`](scripts/AGENTS.md) for script details.

---

**Rule: Add only what agents need to know.** Prefer linking out over inlining detail. Progressive disclosure keeps context windows tight.

**Vendored components:** Never modify files in `dot_agents/skills/vendored/` or other `vendored` directories unless explicitly requested. These are managed by upstream scripts.
