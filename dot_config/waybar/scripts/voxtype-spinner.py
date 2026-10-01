#!/usr/bin/env python3
"""Animate the official `voxtype status --follow --format json` stream."""

import json
import os
import select
import sys
from pathlib import Path

FRAMES = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"
ICONS = {"idle": "\uf130", "recording": "\uf130", "stopped": "\uf131"}


def pink_marker():
    return Path(os.environ["XDG_RUNTIME_DIR"]) / "waybar-voxtype-pink"


def toggle_pink():
    marker = pink_marker()
    if marker.exists():
        marker.unlink()
    else:
        marker.touch(mode=0o600)


def format_status(status, frame=0, pink=False):
    result = status.copy()
    state = status["alt"]
    result["text"] = (
        FRAMES[frame % len(FRAMES)]
        if state == "transcribing"
        else ICONS.get(state, status["text"])
    )
    classes = status.get("class", state)
    result["class"] = [classes] if isinstance(classes, str) else list(classes)
    if pink:
        result["class"].append("pink")
    result["tooltip"] = (
        status["tooltip"]
        + "\nLanguage: AUTO (detect spoken language)"
        + "\nShortcut: Super+Shift+V"
        + "\nClick: toggle pink background (cosmetic only)"
    )
    return result


def emit(status, frame, pink):
    print(json.dumps(format_status(status, frame, pink), ensure_ascii=False), flush=True)


def main():
    pending = b""
    status = None
    frame = 0
    pink = pink_marker().exists()
    while True:
        spinning = status is not None and status["alt"] == "transcribing"
        readable, _, _ = select.select([sys.stdin], [], [], 0.1 if spinning else 0.25)
        next_pink = pink_marker().exists()
        pink_changed = next_pink != pink
        pink = next_pink
        if readable:
            chunk = os.read(sys.stdin.fileno(), 8192)
            if not chunk:
                return
            pending += chunk
            while b"\n" in pending:
                line, pending = pending.split(b"\n", 1)
                if not line:
                    continue
                status = json.loads(line)
                frame = 0
                emit(status, frame, pink)
        elif status is not None and (spinning or pink_changed):
            if spinning:
                frame += 1
            emit(status, frame, pink)


if __name__ == "__main__":
    if sys.argv[1:] == ["--toggle-pink"]:
        toggle_pink()
    else:
        main()
