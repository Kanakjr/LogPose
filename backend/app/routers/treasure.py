"""GET /api/treasure - Treasure Chest contents grouped by rarity."""

from fastapi import APIRouter

from app.db import connect

router = APIRouter()

RARITY_ORDER = (
    "mythic_devil_fruit",
    "legendary_ancient_weapon",
    "rare_cursed_blade",
    "common",
)

RARITY_LABELS = {
    "mythic_devil_fruit": "Mythic Devil Fruit",
    "legendary_ancient_weapon": "Legendary Ancient Weapon",
    "rare_cursed_blade": "Rare Cursed Blade",
    "common": "Common",
}


@router.get("/treasure")
async def treasure() -> dict:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM treasure ORDER BY acquired_at DESC"
        ).fetchall()
    grouped: dict[str, list[dict]] = {r: [] for r in RARITY_ORDER}
    for row in rows:
        rarity = row["rarity"]
        grouped.setdefault(rarity, []).append(dict(row))
    return {
        "groups": [
            {
                "rarity": r,
                "label": RARITY_LABELS.get(r, r),
                "items": grouped.get(r, []),
            }
            for r in RARITY_ORDER
        ],
        "total": len(rows),
    }
