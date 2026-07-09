---
name: mozzarella
description: Commit and push current branch in one shot. Trigger: "mozzarella", "commit and push", "commit this", any request to commit+push the current branch.
---

## Workflow

1. `git add -A` stage all (if secrets/.env/build artifacts detected, add to .gitignore first)
2. Inspect diff size using `git diff --cached --stat`. Only read full `git diff --cached` if changes are small (<100 lines). If large, inspect key changes selectively. Write commit msg per repo convention.
3. Single commit unless asked for multiple
4. Push to current branch
   - No upstream → `git push -u origin <branch>`
   - No remotes → stop, tell user

## Rules

- Subject ≤50, cap 72. Body only if why isn't obvious.
- Context limit: Check diff size with `git diff --cached --stat` first. If >100 lines, inspect selectively; do not dump the full diff into context.
- No force-push, amend published commits, skip hooks.
- Clean tree → say so, no empty commit.
- Pre-commit hook fails → report, stop. No `--no-verify`.
- Extra reqs → modify workflow (e.g. "mozzarella with fix: prefix" → force `fix:` type).

## Extra Instructions

Args (e.g. `/mozzarella use chore: prefix`) → modify commit rules accordingly.
