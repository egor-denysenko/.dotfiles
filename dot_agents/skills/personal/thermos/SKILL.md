---
name: thermos
description: "Run parallel thermo-nuclear correctness and code-quality reviews, then synthesize their findings. Use for thermos, double thermo review, or combined bug/security and code-quality branch audits."
disable-model-invocation: true
---

# Thermos

Run the two thermo review passes as async background subagents in parallel, then synthesize their results.

## Workflow

1. Determine the review scope from the user request, PR, current branch, or relevant changed files.
2. Gather the diff and any file/context excerpts needed for reviewers to evaluate the change without guessing.
3. Read the companion review instructions and assign one pass to each:
   - `../thermo-nuclear-review/SKILL.md`: bugs, breakages, security, devex regressions, feature-flag leaks, and other branch-audit risks.
   - `../thermo-nuclear-code-quality-review/SKILL.md`: maintainability, structure, file-size growth, spaghetti, abstractions, and codebase-health risks.
   Resolve paths relative to this skill's directory. In the chezmoi source tree, the companions live under `../../vendored/` instead.
4. In Pi, enable `subagent` tools if needed, then call `subagent({action: "list", capabilities: true})`. Use the executable builtin `reviewer` for both passes; the companions are **skills**, not named agent definitions. Read the `pi-subagents` skill for the current API.
   - Launch exactly one `subagent({workflow: true, async: true, context: "fresh", cwd: <repo>})` call.
   - Its `js workflow` block must use `await runs.all([...])` with two entries, each with a unique `key`, descriptive `label`, `agent: "reviewer"`, `task`, and durable `output` binding.
   - Give each reviewer its companion instructions (inline or an absolute path to read), the same scoped diff/context, repo/ref, and a read-only boundary. Ask for prioritized findings with file/line references, evidence, smallest fixes, and explicit uncertainty.
   - The reviewer has no shell access. The parent runs requested tests and, after the audit, checks any relevant PR discussion with `gh`/`glab`.
   - Return actual result `outputReference`, `outputPathMapping`, or `artifactPaths`. Yield for native async completion; do not poll or call `bg_wait` just to wait.
   - If discovery or launch fails, report the blocker; do not silently substitute an external CLI or foreground execution.
5. In another harness, use its supported background delegation API with the same two skill prompts. Do not assume Cursor-specific `subagent_type` names exist.
6. After both finish, verify disputed findings and synthesize the results with findings first, deduplicated across reviewers. Weight overlapping findings more heavily, resolve disagreements with your own judgment, and keep summaries brief. Do not apply review fixes unless asked.

If individual background summaries are already visible to the user, do not restate them wholesale. Surface the unified verdict, the highest-signal findings, and any remaining uncertainty.
