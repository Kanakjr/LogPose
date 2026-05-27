"""Bounty tier ladder and Grand Line island progression.

The Captain's Bounty grows with every verified Voyage. Crossing a threshold
ranks them up (Rookie -> Pirate King) and unlocks the next island. Display
in millions of Berries (e.g. 30,000,000 -> "B 30,000,000").
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Tier:
    key: str
    label: str
    threshold: int  # bounty (in raw berries, not millions)


# Bounty tier ladder. Threshold = minimum bounty to wear this rank.
TIERS: tuple[Tier, ...] = (
    Tier("rookie", "Rookie Pirate", 0),
    Tier("supernova", "Supernova", 100_000_000),
    Tier("warlord", "Warlord", 200_000_000),
    Tier("yonko_commander", "Yonko Commander", 500_000_000),
    Tier("yonko", "Yonko", 1_000_000_000),
    Tier("pirate_king", "Pirate King", 5_000_000_000),
)


# Grand Line islands, in order. Each is unlocked by bounty threshold.
ISLANDS: tuple[tuple[str, int], ...] = (
    ("East Blue", 0),
    ("Reverse Mountain", 5_000_000),
    ("Alabasta", 20_000_000),
    ("Skypiea", 50_000_000),
    ("Water 7", 100_000_000),
    ("Enies Lobby", 150_000_000),
    ("Sabaody Archipelago", 200_000_000),
    ("Fishman Island", 300_000_000),
    ("Punk Hazard", 400_000_000),
    ("Dressrosa", 500_000_000),
    ("Whole Cake Island", 750_000_000),
    ("Wano Country", 1_000_000_000),
    ("Egghead", 2_000_000_000),
    ("Laugh Tale", 5_000_000_000),
)


def tier_for_bounty(bounty: int) -> Tier:
    current = TIERS[0]
    for t in TIERS:
        if bounty >= t.threshold:
            current = t
        else:
            break
    return current


def island_for_bounty(bounty: int) -> str:
    current = ISLANDS[0][0]
    for name, threshold in ISLANDS:
        if bounty >= threshold:
            current = name
        else:
            break
    return current


def next_island_for_bounty(bounty: int) -> tuple[str, int] | None:
    for name, threshold in ISLANDS:
        if bounty < threshold:
            return name, threshold
    return None


HAKI_KEYS = ("buso", "vitality", "kenbun", "haoshoku")
HAKI_LABELS = {
    "buso": "Armament Haki",
    "vitality": "Vitality Haki",
    "kenbun": "Observation Haki",
    "haoshoku": "Conqueror's Haki",
}


def format_bounty(b: int) -> str:
    """Stylized: 'B 30,000,000' (using a capital B as the Beli symbol stand-in)."""
    return f"B {b:,}"
