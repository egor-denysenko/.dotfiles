---
description: Add, commit, and push the current repo changes
---

Commit + push repo changes.

Steps:
1. `git add -A` stage all changes.
2. Inspect staged changes, write concise commit message summarizing them.
3. Commit with that message.
4. Push to current branch remote.
   - No upstream → push with upstream tracking.
   - No remotes → don't push.
5. After push, output remote URL.
   - `main` branch → normal repo URL.
   - Other → PR URL into `main`.
   - SSH remotes → convert to HTTPS when printing.

Keep commit message concise.

$ARGUMENTS
