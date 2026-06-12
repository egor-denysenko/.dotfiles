---
name: mozzarella
description: >
  Commit and push the current repository changes. Use when user says "mozzarella",
  "mozzarella it", "mozzarella these changes", "/mozzarella", or asks to commit and push the
  current branch in one shot.
---

# Mozzarella

Commit + push repo changes in one shot.

## Workflow

1. `git add -A` stage all changes
2. `git diff --cached` inspect staged diff, write concise commit message matching repo convention
3. Commit (single commit unless user asks for multiple)
4. Push to current branch remote
   - No upstream → `git push -u origin <branch>`
   - No remotes → stop, tell user
5. After push, print URL:
   - SSH → HTTPS (`git@github.com:owner/repo.git` → `https://github.com/owner/repo`)
   - Default branch → repo URL
   - Other → compare/PR URL (`https://github.com/owner/repo/compare/main...<branch>?expand=1` or `/-/merge_requests/new?source_branch=...`)

## Rules

- Commit msg: subject ≤50 chars, hard cap 72. Body only when why isn't obvious from diff.
- Never force-push, amend published commit, skip hooks.
- `git add -A` picks up secrets/.env/build artefacts → stop and ask before staging.
- Clean working tree → say so, don't create empty commit.
- Pre-commit hook fails → report, stop. Don't bypass with `--no-verify`.
- Extra instructions with request → modify workflow (e.g. "mozzarella with fix: prefix" → force `fix:` commit type).

## Extra Instructions

Invoke with args (e.g. `/mozzarella use chore: prefix`) → append as constraints on rules above.
