"""Devil Fruit Drop System - variable-ratio loot on verified Voyage completion.

This is the Reward Prediction Error engine. Every verified Voyage rolls
against the table. ~85% of the time you just get the base reward; the rest
of the time you may also score a cosmetic, a Berries multiplier, or - very
rarely - a Mythic Devil Fruit that permanently buffs a Haki stat.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Literal

Rarity = Literal[
    "common",
    "rare_cursed_blade",
    "legendary_ancient_weapon",
    "mythic_devil_fruit",
]


@dataclass(frozen=True)
class Drop:
    kind: Literal["nothing", "berries_multiplier", "item"]
    rarity: Rarity | None = None
    item_name: str | None = None
    lore_text: str | None = None
    haki_bonus: str | None = None
    berries_multiplier: float | None = None


# Cumulative probabilities. Tuned to match the plan's published ratios:
#   85% common (no bonus item)
#   12% berries multiplier (cosmetic to the player but feels great)
#   2.5% rare cursed blade
#   0.4% legendary ancient weapon
#   0.1% mythic devil fruit (permanent +2 to a Haki stat)
_RARE_BLADES = [
    ("Rusty Cutlass", "A pirate's first blade. Holds an edge longer than it should."),
    ("Saw-Toothed Sabre", "Notched from a hundred bar-fights. Smells faintly of rum."),
    ("Cursed Tanto", "Whispers in your dreams, but cuts true at dawn."),
    ("Marine-Issue Bayonet", "Stolen off an officer at Loguetown. Still polished."),
    ("Whalebone Dagger", "Carved by an Island Whale's tooth. Lucky for sailors."),
]

_LEGENDARY_WEAPONS = [
    ("Pluton Blueprint Fragment", "A page torn from Iceberg's archive. Worth a Buster Call."),
    ("Poseidon Shell Echo", "A conch that murmurs the Sea Kings' tongue."),
    ("Uranus Sigil", "The ancient sun-mark. Nobody knows what it really does."),
    ("Eternal Pose - Raftel", "Glows when you point it at impossible things."),
]

_MYTHIC_FRUITS = [
    ("Gomu Gomu no Mi", "Your body becomes rubber. Bullets bounce; logic does not.", "buso:+2"),
    ("Hito Hito no Mi: Nika", "The Sun God's joy. Make the impossible look fun.", "haoshoku:+2"),
    ("Mera Mera no Mi", "Fire itself. Cook, fight, sleep warm.", "buso:+2"),
    ("Hana Hana no Mi", "Bloom limbs anywhere. Read three books at once.", "kenbun:+2"),
    ("Yami Yami no Mi", "Pull all light and gravity into your palm.", "haoshoku:+2"),
    ("Tori Tori no Mi: Phoenix", "Heal from any wound. Never a missed sunrise again.", "vitality:+2"),
]


def roll(rng: random.Random | None = None) -> Drop:
    """Roll once on the loot table. Returns a Drop."""
    r = rng or random
    p = r.random()
    if p < 0.85:
        return Drop(kind="nothing")
    if p < 0.97:
        mult = r.choice([2.0, 2.0, 3.0, 5.0])
        return Drop(kind="berries_multiplier", berries_multiplier=mult)
    if p < 0.995:
        name, lore = r.choice(_RARE_BLADES)
        return Drop(kind="item", rarity="rare_cursed_blade", item_name=name, lore_text=lore)
    if p < 0.999:
        name, lore = r.choice(_LEGENDARY_WEAPONS)
        return Drop(kind="item", rarity="legendary_ancient_weapon", item_name=name, lore_text=lore)
    name, lore, haki = r.choice(_MYTHIC_FRUITS)
    return Drop(
        kind="item",
        rarity="mythic_devil_fruit",
        item_name=name,
        lore_text=lore,
        haki_bonus=haki,
    )
