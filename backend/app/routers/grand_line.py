"""GET /api/map - the Grand Line journey, current island, next-island target."""

from fastapi import APIRouter

from app.bounty import ISLANDS, format_bounty, island_for_bounty, next_island_for_bounty
from app.captain import get_captain

router = APIRouter()


@router.get("/map")
async def grand_line() -> dict:
    cap = get_captain()
    bounty = cap.get("bounty", 0)
    here = island_for_bounty(bounty)
    nxt = next_island_for_bounty(bounty)
    islands = []
    for i, (name, threshold) in enumerate(ISLANDS):
        unlocked = bounty >= threshold
        islands.append(
            {
                "name": name,
                "order": i,
                "threshold": threshold,
                "threshold_display": format_bounty(threshold),
                "unlocked": unlocked,
                "current": name == here,
            }
        )
    return {
        "bounty": bounty,
        "bounty_display": format_bounty(bounty),
        "current_island": here,
        "next_island": (
            {
                "name": nxt[0],
                "threshold": nxt[1],
                "threshold_display": format_bounty(nxt[1]),
                "bounty_needed": nxt[1] - bounty,
            }
            if nxt
            else None
        ),
        "islands": islands,
    }
