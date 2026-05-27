#!/usr/bin/env python3
"""Generate the LogPose sprite set with `gemini-2.5-flash-image`.

We feed the high-quality individual chibi crew portraits already on disk
(public/sprites/crew/*.png) as style references so every generated sprite
matches the same chibi-pixel aesthetic: thick black outlines, chunky
pixels, simple flat shading, character/icon centered on a rounded-square
pastel tile.

The result is downscaled to 512x512 PNG and written into
public/sprites/<category>/<name>.png.

Run from the repo root inside a container that can reach the public
internet (the dev Mac's shell sandbox blocks egress, so use the existing
`homebot` container or `python:3.11-slim` with --network host).

Pre-requisites:
    pip install google-genai pillow
    export GEMINI_API_KEY=...

Run:
    python3 Apps/habit/scripts/generate_sprites.py [--only key1,key2]
    python3 Apps/habit/scripts/generate_sprites.py --force        # re-gen
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
STYLE_REFS = [
    ROOT / "ui" / "public" / "sprites" / "crew" / "luffy.png",
    ROOT / "ui" / "public" / "sprites" / "crew" / "zoro.png",
    ROOT / "ui" / "public" / "sprites" / "crew" / "nami.png",
]
OUT = ROOT / "ui" / "public" / "sprites"

STYLE_PREAMBLE = (
    "Create a chibi pixel-art sprite in EXACTLY the same art style as the "
    "reference images: thick black outlines, chunky pixels (about a 64x64 "
    "grid look), simple flat shading, character or object centered on a "
    "rounded-square pastel tile background with a subtle vignette, "
    "generous padding around the subject. Strictly NO text, no letters, no "
    "numerals, no UI labels of any kind. Square format. Subject: "
)

# All sprites the UI references. Each entry maps a relative output path
# under public/sprites/ to the descriptive prompt fragment.
SPRITES: dict[str, str] = {
    "app-icon.png": (
        "A small wooden navigator's compass with a single red needle, "
        "polished gold rim, navy blue tile background."
    ),

    "voyages/sun.png": (
        "A bright pixel sunrise: a yellow-orange sun half-disc above a "
        "horizon line with simple radiating rays, warm amber tile background."
    ),
    "voyages/sword.png": (
        "Two crossed katana blades with red and black hilts forming an X, "
        "slate-blue tile background."
    ),
    "voyages/quill.png": (
        "A single white-and-gold feather quill writing on a small rolled "
        "parchment, cream tile background."
    ),
    "voyages/scroll.png": (
        "An open scroll of paper with simple ink characters and a wax seal, "
        "pale cream tile background."
    ),
    "voyages/water.png": (
        "A tall glass beaker of clear blue water with a single highlight "
        "and a small electrolyte salt sachet beside it, sea-cyan tile "
        "background."
    ),
    "voyages/pill.png": (
        "A single medication capsule, half white half cyan, with a tiny "
        "sparkle, soft mint tile background."
    ),
    "voyages/brew.png": (
        "A steaming brown mug of coffee with a small white heart in the "
        "foam, warm caramel-brown tile background."
    ),
    "voyages/meal.png": (
        "A round white plate top-down view with a piece of grilled chicken, "
        "broccoli, and a half tomato, warm cream tile background."
    ),
    "voyages/bike.png": (
        "A side view of a simple red road bicycle with two large wheels "
        "and a low frame, sky-blue tile background."
    ),
    "voyages/cold.png": (
        "A bright cyan snowflake with a small water droplet at the bottom, "
        "icy pale-blue tile background, subtle frosty glow."
    ),
    "voyages/boots.png": (
        "A pair of brown leather walking boots side by side with laces, "
        "earthy tan tile background."
    ),
    "voyages/moon.png": (
        "A small crescent moon with two tiny stars and a single sparkle, "
        "deep indigo tile background."
    ),
    "voyages/phone-down.png": (
        "A smartphone lying face-down on a flat surface with a small Zzz "
        "symbol above it, calm lavender tile background."
    ),
    "voyages/book.png": (
        "An open book with two visible pages and a red bookmark ribbon, "
        "warm parchment tile background."
    ),

    "captain/tier-1.png": (
        "A young chibi pirate captain in a plain white shirt and shorts, "
        "messy black hair, eager grin, pastel green tile background."
    ),
    "captain/tier-2.png": (
        "A chibi pirate captain in a red coat, scarred chest, confident "
        "smirk, sandstone-orange tile background."
    ),
    "captain/tier-3.png": (
        "A chibi pirate captain mid-action, steam aura rising around him, "
        "red coat, deep crimson tile background."
    ),
    "captain/tier-4.png": (
        "A muscular chibi pirate captain glowing with golden energy, fists "
        "up, dark crimson tile background."
    ),
    "captain/tier-5.png": (
        "A radiant chibi pirate captain crowned in white-gold light, halo "
        "of small clouds behind him, ivory tile background."
    ),

    "devil-fruits/gomu.png": (
        "A round purple-pink devil fruit with thick spiral swirl pattern "
        "and a small green stem on top, plum-purple tile background, "
        "subtle glow."
    ),
    "devil-fruits/mera.png": (
        "A round orange-red devil fruit with flame-shaped swirls and a "
        "small green stem, warm gold tile background, subtle glow."
    ),
    "devil-fruits/yami.png": (
        "A round jet-black devil fruit with violet swirls and a small green "
        "stem, deep indigo tile background, faint purple glow."
    ),
    "devil-fruits/hito.png": (
        "A round cream-white devil fruit with red tip and a small green "
        "stem, pale sky-blue tile background, subtle glow."
    ),

    "chests/wood.png": (
        "A small wooden treasure chest with brass clasps, slightly open "
        "with one gold coin peeking out, warm brown tile background."
    ),
    "chests/silver.png": (
        "A polished silver treasure chest with a jeweled lock, closed, "
        "slate-blue tile background."
    ),
    "chests/gold.png": (
        "An ornate gold treasure chest overflowing with glowing coins and "
        "gems, rich purple tile background."
    ),

    "den-den-mushi.png": (
        "A cute Den Den Mushi snail telephone: a brown snail with a red "
        "rotary phone shell on its back, big eyes, cream tile background."
    ),

    # Islands - canonical Grand Line list from backend/app/bounty.py.
    # File slugs must match slugify(name) so spritePath() resolves them.
    "islands/east-blue.png": (
        "A tiny round green island with a single palm tree, surrounded by "
        "calm blue ocean tile background."
    ),
    "islands/reverse-mountain.png": (
        "Twin reverse mountain peaks with four streams of water flowing "
        "upward toward the top, deep teal tile background."
    ),
    "islands/alabasta.png": (
        "A golden desert pyramid city silhouette under twin suns, warm "
        "gold tile background."
    ),
    "islands/skypiea.png": (
        "A small cloud island floating in the sky with a tiny bell tower, "
        "soft white tile background."
    ),
    "islands/water-7.png": (
        "A canal town with gondolas and a tall central fountain, aqua "
        "tile background."
    ),
    "islands/enies-lobby.png": (
        "A massive courthouse fortress on a rocky island with a waterfall "
        "all around it, stormy slate-blue tile background."
    ),
    "islands/sabaody-archipelago.png": (
        "A giant pink mangrove tree with floating soap bubbles drifting "
        "around it, lavender tile background."
    ),
    "islands/fishman-island.png": (
        "An underwater bubble dome surrounding a small coral palace, "
        "schools of tiny fish around it, deep aqua tile background."
    ),
    "islands/punk-hazard.png": (
        "An island split in half: one side a frozen icy mountain, the other "
        "a fiery red lava field, charcoal-gray tile background."
    ),
    "islands/dressrosa.png": (
        "A colorful flower-petal-strewn coastal kingdom with a tall pink "
        "castle, warm rose tile background."
    ),
    "islands/whole-cake-island.png": (
        "A small island shaped like a giant strawberry-shortcake with "
        "candy trees, pastel pink tile background."
    ),
    "islands/wano-country.png": (
        "A torii gate in front of a snow-capped Mt-Fuji-like mountain with "
        "a cherry-blossom tree, sunset orange tile background."
    ),
    "islands/egghead.png": (
        "A futuristic egg-shaped tech island with circuit patterns and "
        "white-and-cyan domes, cool steel-cyan tile background."
    ),
    "islands/laugh-tale.png": (
        "A mysterious distant island silhouette on the horizon under a "
        "rainbow with a single star above it, magical violet tile "
        "background."
    ),
}


def gen_one(client, refs, rel_path: str, prompt: str, model: str) -> bool:
    target = OUT / rel_path
    target.parent.mkdir(parents=True, exist_ok=True)
    full_prompt = STYLE_PREAMBLE + prompt
    t0 = time.time()
    try:
        resp = client.models.generate_content(
            model=model,
            contents=[*refs, full_prompt],
        )
    except Exception as exc:
        dt = time.time() - t0
        print(f"  FAIL ({dt:.1f}s): {exc}", file=sys.stderr)
        return False

    for cand in resp.candidates or []:
        for part in cand.content.parts or []:
            inline = getattr(part, "inline_data", None)
            if inline and inline.data:
                img = Image.open(BytesIO(inline.data))
                # Downscale to 512x512 for storage; UI renders at <=128px.
                img = img.resize((512, 512), Image.LANCZOS)
                img.save(target, "PNG")
                dt = time.time() - t0
                print(f"  ok ({dt:.1f}s): {target.relative_to(ROOT)}")
                return True

    dt = time.time() - t0
    print(f"  no image returned ({dt:.1f}s)", file=sys.stderr)
    return False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", help="comma-separated subset of sprite keys")
    parser.add_argument("--model", default="gemini-2.5-flash-image")
    parser.add_argument("--force", action="store_true",
                        help="regenerate even if the file already exists")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY not set", file=sys.stderr)
        return 2

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        print("pip install google-genai pillow", file=sys.stderr)
        return 2

    client = genai.Client(api_key=api_key)
    refs = [
        types.Part.from_bytes(data=p.read_bytes(), mime_type="image/png")
        for p in STYLE_REFS
        if p.exists()
    ]
    if len(refs) < 2:
        print("need at least 2 reference sprites in sprites/crew/", file=sys.stderr)
        return 2

    only = set(args.only.split(",")) if args.only else None

    todo: list[tuple[str, str]] = []
    for rel, prompt in SPRITES.items():
        if only and rel not in only:
            continue
        if not args.force and (OUT / rel).exists():
            continue
        todo.append((rel, prompt))

    if not todo:
        print("nothing to generate (all targets exist; use --force to regen)")
        return 0

    print(f"generating {len(todo)} sprite(s) with {args.model}")
    ok = 0
    fail = 0
    for i, (rel, prompt) in enumerate(todo, 1):
        print(f"[{i}/{len(todo)}] {rel}")
        if gen_one(client, refs, rel, prompt, args.model):
            ok += 1
        else:
            fail += 1

    print(f"\ndone: {ok} ok, {fail} failed")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
