# Handoff: Pi Notify Extension

## Context
The user has a Pi coding agent extension at `~/.config/pi/agent/extensions/notify/notify.ts` (chezmoi-managed at `~/.local/share/chezmoi/dot_config/pi/agent/extensions/notify/notify.ts`). It provides:

- **Notifications**: OSC 777 → OSC 99 → notify-send → osascript → visual bell chain
- **Sound**: canberra-gtk-play → paplay → aplay chain
- **Commands**: `/notify-mute`, `/notify-sound`, `/notify-test [info|warning|error]`
- **Events**: `agent_end` (task complete), `tool_execution_end` (errors)
- **Config**: `~/.config/pi/agent/notify.json`

## Problem
Notifications don't fire when invoked manually (e.g. `/notify-test`). Extension loads but produces no output.

## What Was Done
1. **Fixed extension name** — renamed `notify.ts` to `index.ts` for Pi auto-discovery
2. **Fixed `isTerminalFocused()`** — removed the blanket `term === "WezTerm" → true` that suppressed all notifications for WezTerm users

## Still Broken
Notifications still don't fire after `/reload` + `/notify-test`. The temp file shows "Sent: suppressed" or similar — meaning the notification chain runs but hits a guard before sending.

## Debugging Needed
- Verify `isTerminalFocused()` returns `false` (TTY detection may be failing)
- Check `checkMuted()` isn't returning true (env var, file flag, or internal state)
- Check `COOLDOWN_MS` (3s) isn't blocking — try `/notify-test` twice with >3s gap
- Verify `config.notification` and `config.sound` aren't both `false` in `notify.json`
- Check `TERM_PROGRAM` and `TERM` env vars — the OSC detection may not match
- Test each notification layer individually: `sendOSC777`, `sendNotifySend`, etc.
- Check if `execSync` calls are failing silently (notify-send not installed? paplay not available?)

## Key Files
- `~/.config/pi/agent/extensions/notify/index.ts` — live extension (also `notify.ts` backup)
- `~/.config/pi/agent/notify.json` — config
- `~/.local/share/chezmoi/dot_config/pi/agent/extensions/notify/notify.ts` — chezmoi source
- `~/.local/share/chezmoi/dot_config/pi/notify.json` — chezmoi config

## Suggested Skills
- **diagnose** — for systematic debugging of why notifications don't fire
