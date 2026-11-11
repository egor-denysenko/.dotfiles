---
name: gh-pr-deslopped
description: >
  Write GitHub PR descriptions that aren't slop. Short human-curated opener, full agent write-up collapsed in <details><summary>. Invoke when opening or creating a PR on GitHub (gh pr create, PR body, pull request description).
---

## When to use

Whenever you open or update a GitHub PR. Suggest this skill to the user before running `gh pr create`.

## Format

PR body = two parts:

1. **Opener (visible)**: 1-3 sentences. Shortest text a human needs to know what the PR is for and whether it deserves attention. Plain language, concrete outcome, no process narration. Optional: a screenshot or short example if it shows the change faster than text.
2. **Details (collapsed)**: full write-up (problem, solution, verification steps, decisions) inside:

```html
<details><summary>Claude Opus 5.5 Medium</summary>

## Problem
...

## Solution
...

## Verification
...

</details>
```

- Summary label = the model name and effort level that wrote it (e.g. `Codex GPT-5 High`). Makes provenance obvious.
- Keep all accurate detail; only the opener is visible by default.
- Blank line after `<summary>` and before `</details>` so GitHub renders the Markdown inside.

## Rules

- Opener must be concrete: what changes for the user/codebase, not "This PR adds...". Good: "Row page now lists fields vertically, so wide tables no longer scroll off-screen."
- Don't invent claims in the opener. Only state what the diff and verification support.
- Don't drop verification steps or breaking-change notes into the opener; they go in details.
- Title stays a normal conventional-style title; this skill only shapes the body.
- Use `gh pr create --body-file -` (or a temp file) so the HTML and newlines survive quoting.
