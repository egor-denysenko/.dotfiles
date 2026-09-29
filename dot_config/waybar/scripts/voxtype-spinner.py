#!/usr/bin/env python3
"""Animate the official `voxtype status --follow --format json` stream."""

import json
import os
import select
import sys

FRAMES = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"
ICONS = {"idle": "\uf130", "recording": "\uf130", "stopped": "\uf131"}


def format_status(status, frame=0):
    result = status.copy()
    state = status["alt"]
    result["text"] = (
        FRAMES[frame % len(FRAMES)]
        if state == "transcribing"
        else ICONS.get(state, status["text"])
    )
    result["tooltip"] = status["tooltip"] + "\nShortcut: Super+Shift+V"
    return result


def emit(status, frame):
    print(json.dumps(format_status(status, frame), ensure_ascii=False), flush=True)


def main():
    pending = b""
    status = None
    frame = 0
    while True:
        spinning = status is not None and status["alt"] == "transcribing"
        readable, _, _ = select.select([sys.stdin], [], [], 0.1 if spinning else None)
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
                emit(status, frame)
        else:
            frame += 1
            emit(status, frame)


if __name__ == "__main__":
    main()
