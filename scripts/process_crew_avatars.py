#!/usr/bin/env python3
"""Convert the user-provided per-character chibi tiles in
scripts/source-avatars/ into the sprite set the UI expects in
ui/public/sprites/crew/.

Each input PNG has:
    [thick gray outer border] - [colored tile with the character on top
                                  and a NAME label below] - [gray border]

We auto-detect the colored tile edges by finding the first row/col from each
side that contains non-gray pixels, then trim the bottom of the tile to drop
the name label, and finally normalise the result to a square 512x512 PNG +
a 64x64 chat-bubble variant.

Sanji is intentionally skipped (he is not part of the LogPose crew).
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "scripts" / "source-avatars"
OUT_DIR = ROOT / "ui" / "public" / "sprites" / "crew"

CREW = ["luffy", "zoro", "nami", "robin", "chopper"]

# A pixel is "colored" (part of the inner tile, not the border) when its
# saturation exceeds this threshold. The outer border is a very desaturated
# cool gray; the inner tile uses pastel greens/blues/yellows/pinks/purples.
COLOR_SAT_MIN = 0.10

# After cropping out the gray border we drop the bottom NAME_FRAC of the tile
# because that's where the character name sits printed onto the tile.
NAME_FRAC = 0.20

# Final sizes
BIG = 512
CHIP = 64


def is_colored(px: tuple[int, int, int]) -> bool:
    r, g, b = px[0], px[1], px[2]
    mx = max(r, g, b)
    if mx == 0:
        return False
    sat = (mx - min(r, g, b)) / mx
    return sat >= COLOR_SAT_MIN


def row_has_color(im: Image.Image, y: int) -> bool:
    w = im.width
    px = im.load()
    # Need a small run of colored pixels (>= 4 in our sample) to avoid
    # tripping on a single noisy pixel inside the outer border.
    hits = 0
    for x in range(0, w, 4):
        if is_colored(px[x, y]):
            hits += 1
            if hits >= 4:
                return True
        else:
            hits = 0
    return False


def col_has_color(im: Image.Image, x: int) -> bool:
    h = im.height
    px = im.load()
    hits = 0
    for y in range(0, h, 4):
        if is_colored(px[x, y]):
            hits += 1
            if hits >= 4:
                return True
        else:
            hits = 0
    return False


def find_tile_box(im: Image.Image) -> tuple[int, int, int, int]:
    w, h = im.size
    top = 0
    while top < h and not row_has_color(im, top):
        top += 1
    bottom = h - 1
    while bottom > top and not row_has_color(im, bottom):
        bottom -= 1
    left = 0
    while left < w and not col_has_color(im, left):
        left += 1
    right = w - 1
    while right > left and not col_has_color(im, right):
        right -= 1
    return (left, top, right + 1, bottom + 1)


def process(name: str) -> bool:
    src = SRC_DIR / f"{name}.png"
    if not src.exists():
        print(f"skip {name}: missing source")
        return False

    im = Image.open(src).convert("RGB")
    box = find_tile_box(im)
    tile = im.crop(box)

    # Trim the bottom name strip.
    body_h = int(tile.height * (1 - NAME_FRAC))
    body = tile.crop((0, 0, tile.width, body_h))

    # Center-square crop so the character keeps proportions.
    side = min(body.width, body_h)
    cx = (body.width - side) // 2
    cy = (body_h - side) // 2
    sq = body.crop((cx, cy, cx + side, cy + side))

    big = sq.resize((BIG, BIG), Image.LANCZOS)
    chip = sq.resize((CHIP, CHIP), Image.NEAREST)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    big.save(OUT_DIR / f"{name}.png", "PNG")
    chip.save(OUT_DIR / f"{name}.32.png", "PNG")
    print(f"ok {name}: source={im.size} tile={tile.size} body={body.size} square={sq.size}")
    return True


def main() -> int:
    if not SRC_DIR.exists():
        print(f"missing {SRC_DIR}", file=sys.stderr)
        return 1
    any_done = False
    for name in CREW:
        if process(name):
            any_done = True
    return 0 if any_done else 1


if __name__ == "__main__":
    raise SystemExit(main())
