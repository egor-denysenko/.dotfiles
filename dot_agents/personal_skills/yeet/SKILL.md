---
name: yeet
description: >
  Commit and push the current repository changes. Use when user says "yeet",
  "yeet it", "yeet these changes", "/yeet", or asks to commit and push the
  current branch in one shot.
---

# Yeet

Commit and push the current repository changes end to end.

## Workflow

1. `git add -A` to stage all unstaged and untracked changes.
2. Inspect the staged diff (`git diff --cached`) and write a concise commit
   message that accurately summarizes it. Prefer Conventional Commits style when
   the repo already uses it; otherwise mirror whatever convention the project
   already follows.
3. Commit with that message. Use a single commit unless the user explicitly
   asked for multiple.
4. Push the commit to the current branch's remote.
   - If the branch has no upstream, push with `--set-upstream` to the matching
     remote (e.g. `git push -u origin <branch>`).
   - If the repo has no git remotes at all, stop and tell the user — do not
     invent a remote.
5. After a successful push, print a useful URL:
   - Convert SSH remotes like `git@github.com:owner/repo.git` to HTTPS:
     `https://github.com/owner/repo`.
   - If the current branch is `main` (or whatever the project's default
     branch is), print the repo URL.
   - Otherwise, print a compare/PR URL on the host (e.g.
     `https://github.com/owner/repo/compare/main...<branch>?expand=1` for
     GitHub, or the equivalent `/-/merge_requests/new?source_branch=...` for
     GitLab).

## Rules

- Keep the commit message tight. Subject ≤50 chars, hard cap 72. Body only
  when the *why* is not obvious from the diff.
- Never force-push, never amend a published commit, never skip hooks.
- If `git add -A` would pick up secrets, `.env` files, build artefacts, or
  other things the user clearly does not want committed, stop and ask before
  staging.
- If the working tree is clean and there is nothing to commit, say so — do
  not create an empty commit.
- If a pre-commit hook fails, report the failure and stop. Do not bypass with
  `--no-verify`.
- If the user passed extra instructions with the request, treat them as
  modifications to the workflow above (e.g. "yeet with a fix: prefix" means
  force a `fix:` commit type).

## User-provided extra instructions

If invoked with arguments (e.g. `/yeet use chore: prefix`), append them as
constraints on top of the rules above.
