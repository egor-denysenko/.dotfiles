---
name: setup-go-tools
description: Set up dedicated Go tools module (go.tool.mod) or migrate existing repo to this layout. Trigger on go.tool.mod, go tool -modfile, tools folder setup, removing install-tools, separating tool deps from app deps.
user-invocable-only: true
disable-model-invocation: true
---

# Go Tools → `tools/go.tool.mod`

Set up or migrate a repo's dev tools into a dedicated module. Root `go.mod` stays runtime deps only.

## Target layout

```
tools/
├── go.tool.mod   # tool + direct require + indirect require
├── go.tool.sum   # checksums
└── ... # tool configs live here too
```

Makefile:
```make
GO_TOOL := go tool -modfile=tools/go.tool.mod
```

## Steps

### 1. Audit

No tools yet → skip to 2. Otherwise:
- Scan Makefile for `install-tools`, `tools/bin/*`, `go install` calls.
- Move root tool configs (`.golangci.yaml` etc.) into `tools/`.

### 2. Write `tools/go.tool.mod` template

Audit repo tools or ask user which tools + versions. Write full template — **not** a bare stub:

```
module tools

go 1.26

tool (
	github.com/golangci/golangci-lint/v2/cmd/golangci-lint
)

// ── direct tool versions ──
require (
	github.com/golangci/golangci-lint/v2 v2.12.2
)
```

> **`go` directive ≥ highest dep patch.** Tool declares `go 1.26.4` → module must say `go 1.26.4`. Otherwise `go` refuses with `"updates to go.mod needed"`. Safe default: match root module's `go` line.

### 3. Populate indirect deps

Run `go get` listing each tool package explicitly (bare `go get` without args fails in dirs with no `.go` files):

```bash
go -C tools get -modfile=go.tool.mod github.com/golangci/golangci-lint/v2
```

Creates `go.tool.sum`, appends transitive `require` block with `// indirect` entries.

### 4. Wire Makefile

```make
GO_TOOL := go tool -modfile=tools/go.tool.mod
```

Replace `tools/bin/<tool>`, `go install`, `go run -modfile` → `$(GO_TOOL) <cmd-path>`.
Remove `install-tools` target + CI steps calling it.

### 5. Docs

Add `tools/README.md`:

```
Add:    go -C tools get -modfile=go.tool.mod -tool <pkg>@<ver>
Update: go -C tools get -modfile=go.tool.mod <module>@<new-ver>
Remove: delete from tool() + direct require(), then:
        printf 'module tools\n\ngo 1.26\n' > tools/go.tool.mod
        : > tools/go.tool.sum
        go -C tools get -modfile=go.tool.mod -tool <surviving>@<ver>
```

## Verify

- `go tool -modfile=tools/go.tool.mod <tool> --version` works per tool.
- `make lint` / tool targets pass.
- No app/runtime pkgs in `go.tool.mod` require blocks.
- Direct require block: no `// indirect`. Transitive block: all `// indirect`.

## Pitfalls

- **Never `go mod tidy` on tools module.** Bleeds app runtime deps in. Only `go get`.
- **`tool ()` alone not enough.** Missing `require` graph → `no required module provides package`.
- **Invoke cmd path, not library root.** `tool()` gets cmd path (`.../cmd/golangci-lint`). `require()` gets module root (`golangci-lint/v2`). Wrong path → `go: no such tool`.
- **`go get` needs explicit pkg args** in dirs without `.go` files. Bare `go get` → `no package to get`.
- Large indirect graphs from generators/plugins = normal.
