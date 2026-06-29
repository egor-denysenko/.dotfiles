---
name: code-intel
description: Workflow guidance for ast-grep structural search/rewrite and LSP semantic tools. Activates when tasks involve code refactoring, structural search, symbol navigation, pattern matching, or codemod operations.
---

# Code Intelligence — Tool Routing & Workflow Guide

## Tool Routing Decision Model

Use this decision tree to pick the right tool for each step:

```
START
 │
 ├─ "Where is this file / what files exist?"
 │   └─ Use: fff (fast file finder)
 │
 ├─ "What's in this file — functions, classes, exports?"
 │   └─ Use: lsp_symbols (document symbols)
 │
 ├─ "Find all occurrences of a code pattern/shape"
 │   └─ Use: ast_grep_search (structural pattern matching)
 │
 ├─ "What is this symbol's type / signature?"
 │   └─ Use: lsp_hover
 │
 ├─ "Where is this symbol defined?"
 │   └─ Use: lsp_definition
 │
 ├─ "Where is this symbol used?"
 │   └─ Use: lsp_references
 │
 ├─ "Rewrite code structurally across files"
 │   └─ Use: ast_grep_replace (preview mode first!)
 │
 └─ "Did my changes break anything?"
      └─ Use: lsp_diagnostics
```

**Key principle:** Move from broad → narrow. Discover first, understand second, change third, validate last.

## ast-grep Pattern Quick Reference

### Wildcards

| Syntax | Meaning | Example |
|--------|---------|---------|
| `$NAME` | Match single node | `console.log($ARG)` |
| `$$$ARGS` | Match zero or more nodes | `function $FN($$$PARAMS) { $$$BODY }` |

### Common Patterns by Language

**JavaScript / TypeScript:**
```
# Function calls
console.log($ARG)
fetch($URL, $OPTS)

# Imports
import $NAME from '$SOURCE'
import { $$$NAMES } from '$SOURCE'
const $NAME = require('$SOURCE')

# Method chains
$OBJ.then($CB)
$OBJ.catch($CB)
$PROMISE.then($OK).catch($ERR)

# JSX elements
<Component $$$PROPS />
<Component $$$PROPS>$$$CHILDREN</Component>

# Arrow functions
($$$PARAMS) => $EXPR
($$$PARAMS) => { $$$BODY }

# Error handling
try { $$$BODY } catch ($ERR) { $$$HANDLER }
```

**Go:**
```
# Function calls
fmt.Errorf($$$ARGS)
errors.New($MSG)

# Error checks
if $ERR != nil { $$$BODY }

# Struct literals
&SomeStruct{ $$$FIELDS }

# Goroutines
go $FUNC($$$ARGS)

# Defer
defer $EXPR
```

**Python:**
```
# Function definitions
def $FN($$$PARAMS): $$$BODY

# Decorators
@$DECORATOR
def $FN($$$PARAMS): $$$BODY

# With statements
with $EXPR as $VAR: $$$BODY

# List comprehensions
[$EXPR for $VAR in $ITER]
```

## Anti-Patterns — When NOT to Use These Tools

| Don't do this | Do this instead | Why |
|---------------|-----------------|-----|
| `ast_grep_search` for a simple string like `"TODO"` | `fff` or `grep` | ast-grep parses ASTs; plain text search is faster for literals |
| `lsp_definition` when you already know the file path | `read` the file directly | Saves a round-trip; LSP definition is for *discovering* locations |
| `ast_grep_replace` without `--preview` first | Always preview, then apply | Structural rewrites can have unintended matches; inspect before committing |
| `lsp_hover` on every symbol in a file | Use selectively for ambiguous types | Hover is expensive at scale; read the code first, hover when type info matters |
| `lsp_references` across a huge monorepo unscoped | Scope to a directory or module first | Unbounded reference searches can be slow and noisy |
| `ast_grep_search` with overly broad patterns like `$X` | Add structural context: `if ($X) { $$$Y }` | Broad patterns match everything; be specific to get useful results |

## Recommended Workflows

### 1. Refactor a Function / API

```
fff "filename"           → locate relevant files
lsp_symbols file.ts      → map file structure (functions, classes)
ast_grep_search pattern  → find all sites matching the old shape
ast_grep_replace --preview old → new   → review proposed changes
  └─ confirm with user
ast_grep_replace --apply old → new     → execute rewrite
lsp_diagnostics          → verify no type errors introduced
```

### 2. Navigate to a Symbol's Definition

```
fff "filename"           → find the file containing the usage
lsp_symbols file.ts      → identify the symbol in context
lsp_definition symbol    → jump to where it's defined
read definition_file     → read the implementation
```

### 3. Investigate a Type or Interface

```
lsp_hover symbol         → get type signature and docs
lsp_references symbol    → find all usage sites
lsp_definition symbol    → read the type definition source
```

### 4. Codemod Across a Project

```
ast_grep_search pattern --lang typescript     → survey all matches
  └─ review match count and distribution
ast_grep_replace --preview pattern → replacement
  └─ inspect diff output carefully
ast_grep_replace --apply pattern → replacement
lsp_diagnostics                       → catch breakage
  └─ fix any errors, re-run diagnostics
```

### 5. Understand an Unfamiliar Codebase

```
fff ""                   → get project file tree
lsp_symbols key_file     → map exports and structure
lsp_hover main_function  → understand entry point types
lsp_references export    → trace how modules connect
read files as needed     → deep-dive into implementations
```

## Tips

- **Pattern iteration:** Start with a broad ast-grep pattern, inspect matches, then tighten the pattern until it captures exactly what you need.
- **Combine tools freely:** These tools compose well. A common micro-pattern is `lsp_hover` → `lsp_definition` → `read` to go from "what is this?" to full understanding.
- **Scope aggressively:** Most tools accept path or directory arguments. Always scope to the smallest relevant subtree.
- **Diagnostics are cheap:** Run `lsp_diagnostics` liberally after any code change. Catching errors early saves backtracking.
