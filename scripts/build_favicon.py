#!/usr/bin/env python3
"""Generate the favicon / app icon set from the compass app-icon sprite.

Outputs:
    ui/src/app/favicon.ico         (multi-size 16/32/48 ICO, legacy <head> default)
    ui/src/app/icon.png            (32x32, Next.js auto-injects <link rel="icon">)
    ui/src/app/apple-icon.png      (180x180, Next.js auto-injects apple-touch-icon)
    ui/public/icon-192.png         (PWA manifest)
    ui/public/icon-512.png         (PWA manifest)

The source (public/sprites/app-icon.png) is the gemini-generated chibi pixel
compass. We downscale with NEAREST to keep the chunky-pixel feel at small
sizes, then for the larger icons (180/192/512) we use LANCZOS to keep the
gradients on the rim smooth.
"""

from __future__ import annotations

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "ui" / "public" / "sprites" / "app-icon.png"
APP_DIR = ROOT / "ui" / "src" / "app"
PUBLIC_DIR = ROOT / "ui" / "public"


def main() -> int:
    if not SRC.exists():
        raise SystemExit(f"missing source: {SRC}")

    base = Image.open(SRC).convert("RGBA")
    # Make sure the source is square; the gemini output is already 512x512.
    if base.width != base.height:
        side = min(base.size)
        l = (base.width - side) // 2
        t = (base.height - side) // 2
        base = base.crop((l, t, l + side, t + side))

    # Small (favicon.ico, icon.png) - keep pixel chunkiness with NEAREST.
    ico_sizes = [16, 32, 48]
    ico_imgs = []
    for s in ico_sizes:
        intermediate = base.resize((s * 4, s * 4), Image.LANCZOS)
        ico_imgs.append(intermediate.resize((s, s), Image.NEAREST))
    ico_imgs[0].save(
        APP_DIR / "favicon.ico",
        format="ICO",
        sizes=[(s, s) for s in ico_sizes],
        append_images=ico_imgs[1:],
    )
    print(f"wrote {APP_DIR / 'favicon.ico'}  ({ico_sizes})")

    icon_32 = base.resize((128, 128), Image.LANCZOS).resize((32, 32), Image.NEAREST)
    icon_32.save(APP_DIR / "icon.png", "PNG")
    print(f"wrote {APP_DIR / 'icon.png'}  (32x32)")

    # Bigger icons - smooth resample keeps the gold rim & navy tile clean
    # while the pixel-art interior stays sharp because the source already
    # has its own large pixels.
    for size, name, target_dir in [
        (180, "apple-icon.png", APP_DIR),
        (192, "icon-192.png", PUBLIC_DIR),
        (512, "icon-512.png", PUBLIC_DIR),
    ]:
        img = base.resize((size, size), Image.LANCZOS)
        target_dir.mkdir(parents=True, exist_ok=True)
        img.save(target_dir / name, "PNG")
        print(f"wrote {target_dir / name}  ({size}x{size})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
