"""GET /api/journal - voyage history feed for the Voyage Journal page."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query

from app.db import connect

router = APIRouter()


@router.get("/journal")
async def journal(
    since: Optional[int] = Query(None, description="cursor: only attempted_at < since"),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    q = """
        SELECT vl.*, v.title, v.haki_affinity, v.category, t.item_name AS drop_item_name,
               t.rarity AS drop_rarity, t.lore_text AS drop_lore
        FROM voyage_log vl
        JOIN voyages v ON v.id = vl.voyage_id
        LEFT JOIN treasure t ON t.id = vl.drop_item_id
    """
    args: tuple = ()
    if since is not None:
        q += " WHERE vl.attempted_at < ?"
        args = (since,)
    q += " ORDER BY vl.attempted_at DESC LIMIT ?"
    args = args + (limit + 1,)
    with connect() as conn:
        rows = conn.execute(q, args).fetchall()
    items = [dict(r) for r in rows[:limit]]
    has_more = len(rows) > limit
    next_cursor = items[-1]["attempted_at"] if has_more and items else None
    return {"items": items, "has_more": has_more, "next_cursor": next_cursor}
