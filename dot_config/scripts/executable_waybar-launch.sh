#!/bin/sh
# Launch waybar with a usable session D-Bus.
#
# Why this wrapper exists
#   sway's `bar { swaybar_command ... }` spawns waybar from *sway's* own
#   environment. On this machine nothing exports DBUS_SESSION_BUS_ADDRESS:
#   sway-systemd is not installed (so config.d/10-systemd-session.conf no-ops)
#   and Alpine's /etc/user/init.d/sway leaves its export line as a FIXME.
#   With no address, GLib falls back to autolaunching a bus via dbus-launch,
#   which is not installed -- it lives in the misleadingly named dbus-x11
#   package, whose entire contents are that one file. waybar then dies at
#   startup with:
#       [error] Failed to execute child process "dbus-launch" (Permission denied)
#   before drawing anything. `bar` does not respawn, so the failure is silent.
#
# Why D-Bus at all on Wayland
#   Wayland replaced the *display* protocol, not IPC. D-Bus is app-to-app
#   messaging and is unrelated to X11. waybar needs it for the tray
#   (org.kde.StatusNotifierWatcher -- tray icons are published over D-Bus),
#   power-profiles-daemon, and idle_inhibitor. Installing dbus-x11 would
#   only mask the symptom by letting each process autolaunch a private bus,
#   which makes tray icons invisible across process boundaries.
#
# Preferred long-term setup
#   Launch sway as `dbus-run-session -- sway`. That puts a real bus address in
#   *sway's* environment, so waybar, rofi, the polkit agent and every other
#   child inherit it, and the bus is torn down with sway. In that case step 1
#   below short-circuits and this script is a no-op wrapper.
#
# Requires: dbus, waybar
# See also: dot_config/sway/config.d/90-bar.conf

set -eu

: "${XDG_RUNTIME_DIR:=/run/user/$(id -u)}"
export XDG_RUNTIME_DIR

bus_socket="$XDG_RUNTIME_DIR/bus"
default_address="unix:path=$bus_socket"

if ! command -v waybar >/dev/null 2>&1; then
	echo "waybar-launch: waybar not found in PATH" >&2
	exit 1
fi

# A session bus that actually answers, not just a socket file that exists --
# a stale socket left behind by a dead daemon is the failure mode this whole
# exercise exists to work around.
bus_responds() {
	[ -n "${1:-}" ] || return 1
	DBUS_SESSION_BUS_ADDRESS="$1" dbus-send --session \
		--dest=org.freedesktop.DBus --type=method_call --print-reply \
		/org/freedesktop/DBus org.freedesktop.DBus.GetId >/dev/null 2>&1
}

if bus_responds "${DBUS_SESSION_BUS_ADDRESS:-}"; then
	# Inherited a working bus (dbus-run-session, or an earlier launch).
	:
elif bus_responds "$default_address"; then
	DBUS_SESSION_BUS_ADDRESS="$default_address"
	export DBUS_SESSION_BUS_ADDRESS
else
	# Nothing usable. --fork detaches, so the bus outlives this script and
	# stays available to the rest of the session.
	dbus-daemon --session --fork --address="$default_address" --print-address=1 >/dev/null
	DBUS_SESSION_BUS_ADDRESS="$default_address"
	export DBUS_SESSION_BUS_ADDRESS

	# It normally listens before --fork returns; retry briefly regardless so
	# a slow start cannot race waybar's first bus call.
	tries=0
	while [ "$tries" -lt 20 ]; do
		bus_responds "$default_address" && break
		tries=$((tries + 1))
		sleep 0.1
	done
fi

# xdg-desktop-portal selects its backend from XDG_CURRENT_DESKTOP, and
# sway-systemd (which would normally set this) is not installed here.
XDG_CURRENT_DESKTOP="${XDG_CURRENT_DESKTOP:-sway}"
XDG_SESSION_TYPE="${XDG_SESSION_TYPE:-wayland}"
export XDG_CURRENT_DESKTOP XDG_SESSION_TYPE

exec waybar "$@"
