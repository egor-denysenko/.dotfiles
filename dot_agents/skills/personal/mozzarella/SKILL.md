---
name: mozzarella
description: Commit and push current branch in one shot. Trigger: "mozzarella", "commit and push", "commit this", any request to commit+push the current branch.
---

## Workflow

1. `git add -A` stage all (if secrets/.env/build artifacts detected, add to .gitignore first)
2. Read `git diff --cached`, write commit msg per repo convention
3. Single commit unless asked for multiple
4. Push to current branch
   - No upstream → `git push -u origin <branch>`
   - No remotes → stop, tell user

## Rules

- Subject ≤50, cap 72. Body only if why isn't obvious.
- No force-push, amend published commits, skip hooks.
- Clean tree → say so, no empty commit.
- Pre-commit hook fails → report, stop. No `--no-verify`.
- Extra reqs → modify workflow (e.g. "mozzarella with fix: prefix" → force `fix:` type).

## Extra Instructions

Args (e.g. `/mozzarella use chore: prefix`) → modify commit rules accordingly.
