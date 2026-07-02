# Chezmoi Dotfiles

Dotfiles managed by chezmoi. Scripts prefixed `executable_run_once_` run once on `chezmoi apply`; `executable_` makes them executable.

See [`scripts/AGENTS.md`](scripts/AGENTS.md) for script details.

---

**Rule: Add only what agents need to know.** Prefer linking out over inlining detail. Progressive disclosure keeps context windows tight.
