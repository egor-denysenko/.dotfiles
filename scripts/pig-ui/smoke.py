"""Live PiG UI smoke test. No model prompts or desktop notifications are sent.

Run after chezmoi apply: python3 scripts/pig-ui/smoke.py
Uses the deployed config and existing provider login; leaves sessions untouched.
"""
import fcntl
import os
import pty
import re
import select
import signal
import struct
import subprocess
import termios
import time


ANSI = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)")


def main():
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 50, 100, 0, 0))
    env = dict(os.environ, PIG_HOME=os.path.expanduser("~/.config/pig"), PIG_NOTIFY_MUTE="1")
    process = subprocess.Popen(
        ["pig", "--no-session", "--offline", "--no-approve", "--tui-mode", "regular"],
        stdin=slave, stdout=slave, stderr=slave, cwd="/tmp", env=env, start_new_session=True,
    )
    os.close(slave)
    transcript = bytearray()

    def read(seconds=0.5):
        output = bytearray()
        until = time.monotonic() + seconds
        while time.monotonic() < until:
            if select.select([master], [], [], 0.05)[0]:
                try:
                    chunk = os.read(master, 65536)
                except OSError:
                    break
                if not chunk:
                    break
                output.extend(chunk)
        transcript.extend(output)
        return ANSI.sub("", output.decode(errors="replace"))

    def send(data, seconds=0.6):
        os.write(master, data)
        return read(seconds)

    try:
        startup = ""
        deadline = time.monotonic() + 30
        while "👁" not in startup and time.monotonic() < deadline:
            startup += read()
            assert process.poll() is None, startup
        assert "startup:" in startup, "Startup widget did not render"
        assert "Press" in startup, "Native PiG header did not render"
        assert "👁" in startup, "Vision footer did not render"
        assert "Extension issues" not in startup, startup

        send(b"/startup\r")
        assert "startup:" in send(b"/startup\r"), "Startup widget did not toggle back on"

        picker = send(b"\x0c", 1)
        assert "Provider:" in picker and "Tab/Shift+Tab:" in picker, picker
        assert "Provider:" in send(b"\t"), "Provider tab did not redraw"
        send(b"\x1b[Z")
        send(b"\x1b")

        send(b"PIG_UI_STASH_REGRESSION")
        assert "Stashes: 1" in send(b"\x13"), "Ctrl+S did not stash"
        assert "PIG_UI_STASH_REGRESSION" in send(b"\x13"), "Ctrl+S did not restore"
        send(b"\x03")
        for width in (40, 20, 80, 120):
            fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack("HHHH", 50, width, 0, 0))
            os.kill(process.pid, signal.SIGWINCH)
            read()
            assert process.poll() is None, f"UI exited at width {width}"
            picker = send(b"\x0c")
            assert "Provider:" in picker, f"Picker failed at width {width}"
            send(b"\x1b")

        send(b"\x04", 2)
        process.wait(timeout=10)
        plain = ANSI.sub("", transcript.decode(errors="replace"))
        for failure in ("exceeds terminal width", "Extension issues", "TypeError", "ReferenceError", "panic:"):
            assert failure not in plain, plain[-5000:]
        assert process.returncode == 0, process.returncode
        print("PASS: native header + startup widget/toggle, vision footer, provider tabs, stash/restore, widths 20/40/80/120, clean exit")
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        os.close(master)


if __name__ == "__main__":
    main()
