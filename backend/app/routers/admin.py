"""Admin endpoints: re-seed the Straw Hat Pack, reset state for dev."""

from fastapi import APIRouter, Query

from app.captain import get_captain
from app.db import connect, now_ts
from app.seed import seed_voyages

router = APIRouter()


@router.post("/admin/seed")
async def reseed(force_reset: bool = Query(False)) -> dict:
    inserted = seed_voyages(force_reset=force_reset)
    return {"ok": True, "inserted": inserted, "force_reset": force_reset}


@router.post("/admin/reset_captain")
async def reset_captain() -> dict:
    """Wipe the Captain back to a Rookie. Keeps voyages and the streak grid."""
    with connect() as conn:
        conn.execute(
            """
            UPDATE captain SET
                bounty = 0,
                berries = 0,
                morale_current = 100,
                morale_max = 100,
                haki_buso = 1,
                haki_vitality = 1,
                haki_kenbun = 1,
                haki_haoshoku = 1,
                bounty_tier = 'rookie',
                current_island = 'East Blue',
                updated_at = ?
            WHERE id = 1
            """,
            (now_ts(),),
        )
    return {"ok": True, "captain": get_captain()}
