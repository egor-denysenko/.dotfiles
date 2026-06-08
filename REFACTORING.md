# Refactoring Opportunities

Future architectural work worth revisiting. Terms below use the shared architecture vocabulary: Module, Interface, Implementation, Depth, Seam, Adapter, Leverage, Locality.

## 1. Machine Profile Module For Pi Agent Config

**Files**
- `dot_config/pi/agent/settings.json.tmpl`
- `dot_config/pi/agent/models.json`
- `.chezmoi.toml.tmpl`

**Problem**
- `machine` is one concept, but its Interface is split across chezmoi data, Pi settings, and provider metadata.
- Understanding one machine profile requires bouncing between multiple files.
- By the deletion test, deleting one side of this split does not remove complexity, it just moves it.

**Opportunity**
- Create one machine profile Module as the source of truth for Pi agent configuration.
- Render `settings.json` and `models.json` from that Module.

**Benefits**
- More Depth around machine type.
- Better Locality for personal vs work behavior.
- More Leverage when changing provider or model policy.
- Clearer tests: given a machine type, render a profile.

## 2. Skills Bootstrap Module

**Files**
- `scripts/install-skills.sh`
- `dot_config/scripts/run_once_ensure_agents_skills_dir.sh`
- `dot_config/scripts/run_once_symlink_pi_skills.sh`
- `README.md`

**Problem**
- The shared-skills setup concept is spread across several shallow Module implementations.
- Ownership is unclear: multiple entrypoints partly manage the same setup.
- By the deletion test, each script partly survives deletion of the others, which suggests low Depth.

**Opportunity**
- Collapse skills setup into one owning Module.
- Keep other entrypoints as thin Adapters or remove them.

**Benefits**
- Better Locality for onboarding and debugging.
- One Interface to learn and test.
- More Leverage when installation paths change.

## 3. RTK Policy Module

**Files**
- `dot_config/pi/agent/extensions/private_rtk.ts`
- `dot_config/opencode/plugins/rtk.ts`
- `dot_config/pi/agent/extensions/custom-system-prompt.ts`
- `dot_config/pi/agent/docs/rtk.md`
- `dot_config/pi/agent/AGENTS.md`

**Problem**
- The "prefer RTK" policy is expressed in multiple Modules: docs, prompt shaping, and runtime rewriting.
- One Seam is brittle because prompt rewriting depends on upstream prompt text staying stable.
- Changing RTK behavior requires touching multiple places, which hurts Locality.

**Opportunity**
- Make one RTK policy Module own the behavior.
- Keep Pi and opencode integrations as thin Adapters.
- Keep docs explanatory, not a second policy source.

**Benefits**
- Better Locality for RTK behavior.
- More Leverage from one policy change.
- A clearer Seam around rewrite behavior.
- Easier tests at the Interface instead of through prompt text.

## 4. Vendored Skills Manifest Module

**Files**
- `.chezmoidata/third_party_skills.yaml`
- `scripts/vendor-skills.sh`

**Problem**
- The manifest Interface is thin, while important vendoring policy lives inside shell Implementation.
- To understand what vendoring does, a caller must read both the YAML and shell internals.
- That makes the Module shallow.

**Opportunity**
- Deepen the manifest Module so more vendoring policy is explicit in data.
- Let `vendor-skills.sh` become a thinner Adapter over that manifest.

**Benefits**
- More Depth in the manifest.
- Better Locality during review and debugging.
- More Leverage from data-only updates.
- Better testability because the Interface becomes inspectable.

## 5. Shared Agent Workflow Module

**Files**
- `dot_agents/skills/personal/learning-buddy/SKILL.md`
- `dot_config/opencode/modes/learn.md`
- `dot_config/opencode/agents/learn.md`
- `dot_agents/skills/personal/plan-first/SKILL.md`
- `dot_config/opencode/modes/plan-first.md`
- `dot_agents/skills/personal/yeet/SKILL.md`
- `dot_config/opencode/commands/yeet.md`

**Problem**
- The same workflow concepts exist in multiple Modules with overlapping Interface and Implementation.
- These are shallow copies more than deep Modules.
- Changing one workflow requires hunting down tool-specific copies.

**Opportunity**
- Make each workflow a canonical Module.
- Keep tool-specific files as thin Adapters.

**Benefits**
- Better Locality for workflow changes.
- More Depth in shared workflows.
- More Leverage from one prompt change.
- Simpler tests because the Interface is defined once.
