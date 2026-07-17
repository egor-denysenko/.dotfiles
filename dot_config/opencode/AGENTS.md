# Global OpenCode Rules

Prefer using RTK for shell commands when available.
Use edit over write.
Test after changes.

## RTK Reference

Always prefix with `rtk`. Safe everywhere — passes through if no dedicated filter.

```
rtk cargo build / check / clippy / test
rtk tsc / lint / prettier --check
rtk vitest run / playwright test
rtk git <any-subcommand>
rtk gh pr view / checks / run list / issue list / api
rtk pnpm list / outdated / install
rtk pnpm run / pnpm dlx
rtk ls / read / grep / find (simple predicates only; use native `find` for `-o`, `-not`, `-exec`, grouped expressions)
rtk err <cmd> / log <file> / json <file>
rtk docker ps / images / logs
rtk kubectl get / logs
rtk curl / wget
rtk gain / proxy <cmd>
```
