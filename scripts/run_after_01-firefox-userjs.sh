#!/bin/sh
# Copy the chezmoi-rendered user.js into the active Firefox profile.
# Runs after `chezmoi apply` (run_after_ prefix).
#
# Why a copy step at all
#   Firefox reads user.js from the *profile* directory, and the profile name is
#   machine-generated (mhvvd315.default-release here). chezmoi cannot write to
#   a path it does not know the name of, so the template lands in a fixed
#   staging path and this script fans it out to whichever profile exists.
#
# Why ~/.config/mozilla and not ~/.mozilla
#   Firefox follows XDG_CONFIG_HOME, which is unset here, so it resolves to
#   ~/.config/mozilla/firefox. The template was originally deployed to
#   ~/.mozilla/firefox/user.js, a path this machine's Firefox never reads --
#   the prefs silently had no effect. Both paths are honoured below so the
#   script works on hosts that do set XDG_CONFIG_HOME or a real ~/.mozilla.
#
# Writes are non-destructive: an existing user.js in the profile is backed up
# once, because Firefox also *writes* user.js when you change a pref in about:config.

STAGING="$XDG_CONFIG_HOME/mozilla/firefox/user.js"
[ -f "$STAGING" ] || STAGING="$HOME/.mozilla/firefox/user.js"

if [ ! -f "$STAGING" ]; then
	echo "firefox-userjs: no staged user.js (looked in \$XDG_CONFIG_HOME/mozilla/firefox and ~/.mozilla/firefox), skipping"
	exit 0
fi

PROFILE_DIR="${STAGING%/user.js}"

# default-release first: that is the profile `firefox` opens by default when
# profiles.ini marks it Default=1. Fall back to any other *.default* profile.
PROFILE=$(find "$PROFILE_DIR" -maxdepth 1 -type d -name '*.default-release' 2>/dev/null | head -1)
[ -n "$PROFILE" ] || PROFILE=$(find "$PROFILE_DIR" -maxdepth 1 -type d -name '*.default*' 2>/dev/null | head -1)

if [ -z "$PROFILE" ]; then
	echo "firefox-userjs: no Firefox profile under $PROFILE_DIR, skipping"
	exit 0
fi

# Only overwrite a user.js we did not write, and keep the old one once.
if [ -f "$PROFILE/user.js" ] && ! cmp -s "$STAGING" "$PROFILE/user.js"; then
	if [ ! -f "$PROFILE/user.js.chezmoi-backup" ]; then
		cp "$PROFILE/user.js" "$PROFILE/user.js.chezmoi-backup"
	fi
fi

cp "$STAGING" "$PROFILE/user.js"
echo "firefox-userjs: installed $STAGING -> $PROFILE/user.js"
