"""GET /api/captain - the Wanted Poster + Haki radar + island position."""

from fastapi import APIRouter

from app.bounty import (
    HAKI_LABELS,
    TIERS,
    format_bounty,
    next_island_for_bounty,
    tier_for_bounty,
)
from app.captain import get_captain

router = APIRouter()


@router.get("/captain")
async def captain() -> dict:
    cap = get_captain()
    bounty = cap.get("bounty", 0)
    tier = tier_for_bounty(bounty)
    next_island = next_island_for_bounty(bounty)

    return {
        "name": cap.get("name", "Captain"),
        "bounty": bounty,
        "bounty_display": format_bounty(bounty),
        "berries": cap.get("berries", 0),
        "morale": {
            "current": cap.get("morale_current", 100),
            "max": cap.get("morale_max", 100),
        },
        "haki": {
            "buso": {
                "level": cap.get("haki_buso", 1),
                "label": HAKI_LABELS["buso"],
            },
            "vitality": {
                "level": cap.get("haki_vitality", 1),
                "label": HAKI_LABELS["vitality"],
            },
            "kenbun": {
                "level": cap.get("haki_kenbun", 1),
                "label": HAKI_LABELS["kenbun"],
            },
            "haoshoku": {
                "level": cap.get("haki_haoshoku", 1),
                "label": HAKI_LABELS["haoshoku"],
            },
        },
        "tier": {
            "key": tier.key,
            "label": tier.label,
            "threshold": tier.threshold,
        },
        "tier_ladder": [
            {"key": t.key, "label": t.label, "threshold": t.threshold} for t in TIERS
        ],
        "current_island": cap.get("current_island", "East Blue"),
        "next_island": (
            {"name": next_island[0], "threshold": next_island[1]}
            if next_island
            else None
        ),
    }
