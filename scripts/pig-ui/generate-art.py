"""Generate pig-is-fine.sh's half-block artwork. Standard library only.

Run from any directory: python3 scripts/pig-ui/generate-art.py
Use --preview /tmp/pig-is-fine.png for a nearest-neighbor PNG preview.
"""
import argparse
from pathlib import Path
import struct
import zlib

WIDTH, HEIGHT = 45, 50
PALETTE = {
    ".": None,
    "r": (189, 65, 24),
    "o": (209, 85, 28),
    "f": (224, 112, 33),
    "a": (235, 151, 28),
    "y": (247, 192, 52),
    "l": (255, 218, 96),
    "k": (53, 33, 29),
    "h": (132, 78, 43),
    "t": (185, 122, 62),
    "s": (223, 164, 89),
    "p": (239, 151, 165),
    "q": (255, 186, 194),
    "v": (204, 103, 129),
    "n": (170, 75, 101),
    "w": (255, 241, 209),
    "b": (170, 53, 43),
    "c": (218, 79, 55),
    "d": (109, 61, 38),
}
pixels = [["."] * WIDTH for _ in range(HEIGHT)]


def rect(x0, y0, x1, y1, color):
    for y in range(max(0, y0), min(HEIGHT, y1 + 1)):
        for x in range(max(0, x0), min(WIDTH, x1 + 1)):
            pixels[y][x] = color


def polygon(points, color):
    for y in range(HEIGHT):
        for x in range(WIDTH):
            inside = False
            px, py = x + 0.5, y + 0.5
            for i, (ax, ay) in enumerate(points):
                bx, by = points[(i + 1) % len(points)]
                if (ay > py) != (by > py) and px < (bx - ax) * (py - ay) / (by - ay) + ax:
                    inside = not inside
            if inside:
                pixels[y][x] = color


# A rounded inferno, with staggered tongues rather than a rectangular backdrop.
polygon([(0, 33), (2, 22), (5, 18), (4, 14), (7, 15), (9, 23),
         (10, 12), (14, 5), (14, 12), (17, 15), (19, 7), (20, 0),
         (24, 0), (26, 5), (25, 10), (29, 16), (31, 12), (31, 8),
         (35, 6), (36, 12), (35, 17), (39, 23), (40, 17), (43, 15),
         (42, 22), (45, 30), (45, 41), (42, 46), (35, 49), (13, 50),
         (5, 47), (1, 42)], "o")
polygon([(2, 34), (5, 25), (5, 20), (9, 25), (12, 17), (13, 10),
         (17, 19), (20, 13), (22, 3), (24, 7), (23, 12), (28, 20),
         (31, 18), (34, 11), (34, 19), (39, 28), (42, 22), (42, 29),
         (44, 36), (42, 44), (34, 48), (13, 48), (6, 45), (2, 40)], "f")
polygon([(5, 36), (8, 30), (8, 24), (12, 29), (15, 22), (17, 13),
         (20, 20), (23, 17), (24, 12), (29, 26), (32, 23), (34, 17),
         (36, 29), (40, 32), (41, 28), (43, 36), (40, 43), (33, 47),
         (13, 47), (6, 43)], "a")
polygon([(8, 39), (12, 32), (13, 27), (17, 33), (20, 26), (21, 21),
         (26, 32), (30, 29), (32, 25), (35, 35), (39, 36), (40, 41),
         (34, 45), (15, 46), (9, 43)], "y")
polygon([(7, 42), (10, 37), (10, 33), (14, 40), (17, 38), (20, 32),
         (25, 39), (30, 36), (34, 41), (39, 42), (33, 46), (15, 46)], "l")
# Detached embers and small bright flame cores.
rect(8, 8, 8, 9, "o")
rect(37, 3, 38, 4, "f")
rect(3, 25, 3, 27, "a")
rect(41, 32, 41, 35, "y")
rect(6, 34, 6, 37, "y")

# Cowboy hat: pinched crown, dark hatband, upturned broad brim.
polygon([(13, 22), (14, 15), (17, 11), (20, 11), (23, 14), (26, 11),
         (29, 12), (32, 16), (33, 23)], "k")
polygon([(15, 21), (16, 16), (18, 13), (20, 13), (23, 16), (26, 13),
         (28, 14), (30, 17), (31, 22)], "t")
polygon([(16, 17), (18, 13), (20, 13), (23, 16), (23, 20), (16, 20)], "s")
rect(15, 20, 31, 22, "h")
rect(15, 22, 32, 23, "k")
polygon([(9, 20), (12, 22), (33, 22), (36, 20), (35, 25), (32, 26),
         (13, 26), (10, 24)], "k")
polygon([(10, 21), (13, 23), (32, 23), (35, 21), (34, 24), (31, 25),
         (14, 25), (11, 23)], "t")
rect(14, 23, 31, 23, "s")

# Ears and soft, broad pig cheeks beneath the brim.
polygon([(12, 26), (17, 27), (29, 27), (34, 25), (34, 31), (33, 33),
         (33, 38), (30, 41), (27, 42), (18, 42), (14, 40), (12, 36)], "k")
polygon([(13, 27), (18, 29), (28, 29), (33, 27), (32, 33), (32, 37),
         (29, 40), (26, 41), (18, 41), (15, 39), (13, 35)], "p")
polygon([(14, 28), (17, 29), (15, 32)], "v")
polygon([(30, 29), (32, 28), (31, 32)], "n")
rect(17, 27, 28, 29, "p")
rect(17, 29, 29, 36, "q")
rect(15, 33, 16, 36, "q")
# Relaxed half-lidded eyes, glancing toward the coffee.
rect(16, 29, 20, 29, "k")
rect(25, 29, 29, 29, "k")
rect(16, 30, 20, 32, "w")
rect(25, 30, 29, 32, "w")
rect(19, 30, 20, 32, "k")
rect(28, 30, 29, 32, "k")
# Oversized rounded snout, with two unmistakable nostrils.
polygon([(19, 33), (27, 33), (30, 35), (30, 38), (27, 40), (19, 40),
         (17, 38), (17, 35)], "n")
polygon([(20, 34), (27, 34), (29, 35), (29, 38), (27, 39), (19, 39),
         (18, 37), (18, 35)], "p")
rect(20, 34, 26, 34, "q")
rect(20, 36, 21, 37, "k")
rect(26, 36, 27, 37, "k")
rect(21, 40, 25, 40, "k")
rect(22, 41, 24, 41, "p")

# Vest, red bandanna, sheriff star, and a hoof resting by the mug.
polygon([(16, 41), (19, 42), (27, 42), (30, 41), (33, 44), (34, 48),
         (13, 48), (14, 44)], "k")
rect(15, 44, 31, 47, "t")
rect(22, 43, 25, 47, "w")
polygon([(17, 41), (22, 43), (28, 41), (27, 44), (23, 45), (18, 44)], "b")
rect(19, 42, 21, 43, "c")
rect(23, 44, 24, 46, "c")
# Five-point badge in gold.
rect(17, 44, 17, 46, "l")
rect(15, 45, 19, 45, "l")
rect(16, 47, 16, 47, "y")
rect(18, 47, 18, 47, "y")
rect(29, 45, 34, 47, "k")
rect(29, 45, 33, 46, "p")
rect(33, 46, 34, 46, "v")

# Coffee cup: steam, cream ceramic, dark coffee, and a square handle.
rect(37, 36, 37, 37, "w")
rect(38, 34, 38, 35, "w")
rect(40, 35, 40, 36, "w")
rect(39, 37, 39, 38, "w")
rect(35, 39, 41, 39, "k")
rect(34, 40, 41, 45, "k")
rect(35, 40, 40, 44, "w")
rect(36, 40, 39, 40, "d")
rect(41, 40, 43, 40, "w")
rect(43, 41, 43, 43, "w")
rect(41, 44, 42, 44, "w")
rect(36, 45, 40, 45, "k")
# Table anchors the scene, just as the coffee does in the meme.
rect(27, 48, 43, 48, "k")
rect(28, 49, 42, 49, "t")


def preview(path):
    scale = 10
    background = (28, 26, 28)
    raw = bytearray()
    for row in pixels:
        scanline = b"".join(bytes(PALETTE[pixel] or background) * scale for pixel in row)
        for _ in range(scale):
            raw.extend(b"\0" + scanline)

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))

    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", WIDTH * scale, HEIGHT * scale, 8, 2, 0, 0, 0))
                     + chunk(b"IDAT", zlib.compress(bytes(raw))) + chunk(b"IEND", b""))


def generate():
    # A readable indexed pixel grid is rendered with the same ANSI truecolor
    # half-block technique as thisisfine.sh (two pixel rows per terminal row).
    colors = "\n".join(f'  palette["{key}"] = "{r};{g};{b}"' for key, value in PALETTE.items()
                       if value is not None for r, g, b in [value])
    grid = "\n".join("".join(row) for row in pixels)
    return '''#!/usr/bin/env sh
# Sheriff pig in the inferno: ANSI truecolor half-block art, like thisisfine.sh.
# Generated by scripts/pig-ui/generate-art.py; edit the generator to change art.
set -eu

# Keep color when captured by a UI component, just like thisisfine.sh.
color=1
[ -z "${NO_COLOR+x}" ] || color=0
case "${1:-}" in
  --color) color=1 ;;
  --no-color) color=0 ;;
  --help|-h)
    printf '%s\\n' 'Usage: pig-is-fine.sh [--color|--no-color]' \\
      'Sheriff pig in flames. Requires a UTF-8 terminal; truecolor recommended.'
    exit 0 ;;
  '') ;;
  *) printf 'Unknown option: %s\\n' "$1" >&2; exit 2 ;;
esac
if [ "$#" -gt 1 ]; then
  printf '%s\\n' 'Expected at most one option. Use --help.' >&2
  exit 2
fi

awk -v color="$color" '
BEGIN {
  esc = sprintf("%c", 27)
''' + colors + '''
}
NR % 2 { upper = $0; next }
{
  for (x = 1; x <= length($0); x++) {
    top = substr(upper, x, 1)
    bottom = substr($0, x, 1)
    if (color) {
      fg = top == "." ? "39" : "38;2;" palette[top]
      bg = bottom == "." ? "49" : "48;2;" palette[bottom]
      printf "%s[%s;%sm", esc, fg, bg
      if (top == ".") {
        if (bottom == ".") printf " "
        else printf "%s[38;2;%s;49m▄", esc, palette[bottom]
      } else printf "▀"
    } else {
      if (top == "." && bottom == ".") printf " "
      else if (top == ".") printf "▄"
      else if (bottom == ".") printf "▀"
      else printf "█"
    }
  }
  if (color) printf "%s[0m", esc
  printf "\\n"
}
' <<'PIXELS'
''' + grid + "\nPIXELS\n"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview", type=Path)
    args = parser.parse_args()
    target = Path(__file__).resolve().parents[2] / "dot_config/pig/agent/extensions/executable_pig-is-fine.sh"
    target.write_text(generate())
    if args.preview:
        preview(args.preview)
