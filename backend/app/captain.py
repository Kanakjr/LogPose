"""Captain state helpers - read, award bounty, tick morale, level Haki.

Single-row Captain at id=1. All mutations go through here so events get
emitted consistently and the crew service can react.
"""

from __future__ import annotations

import json
import sqlite3
from typing import Any

from app.bounty import island_for_bounty, tier_for_bounty
from app.db import connect, now_ts


def get_captain() -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute("SELECT * FROM captain WHERE id = 1").fetchone()
    if row is None:
        return {}
    return _row_to_dict(row)


def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    captain = dict(row)
    tier = tier_for_bounty(captain["bounty"])
    captain["bounty_tier_key"] = tier.key
    captain["bounty_tier_label"] = tier.label
    captain["current_island"] = island_for_bounty(captain["bounty"])
    return captain


def _emit_event(conn: sqlite3.Connection, type_: str, payload: dict) -> None:
    conn.execute(
        "INSERT INTO events (ts, type, payload) VALUES (?, ?, ?)",
        (now_ts(), type_, json.dumps(payload)),
    )


def award_bounty(
    *,
    bounty: int,
    berries: int,
    haki_affinity: str | None = None,
    haki_amount: int = 1,
) -> dict[str, Any]:
    """Add bounty + berries; bump the affinity Haki stat; detect tier-up.

    Returns the updated captain dict plus a ``tier_up`` field if the tier
    crossed a boundary.
    """
    with connect() as conn:
        row = conn.execute("SELECT * FROM captain WHERE id = 1").fetchone()
        old_bounty = row["bounty"]
        new_bounty = old_bounty + bounty
        new_berries = row["berries"] + berries

        old_tier = tier_for_bounty(old_bounty)
        new_tier = tier_for_bounty(new_bounty)

        haki_col = None
        if haki_affinity in ("buso", "vitality", "kenbun", "haoshoku"):
            haki_col = f"haki_{haki_affinity}"

        if haki_col:
            conn.execute(
                f"""
                UPDATE captain
                SET bounty = ?, berries = ?, bounty_tier = ?,
                    current_island = ?, {haki_col} = {haki_col} + ?,
                    updated_at = ?
                WHERE id = 1
                """,
                (
                    new_bounty,
                    new_berries,
                    new_tier.key,
                    island_for_bounty(new_bounty),
                    haki_amount,
                    now_ts(),
                ),
            )
        else:
            conn.execute(
                """
                UPDATE captain
                SET bounty = ?, berries = ?, bounty_tier = ?,
                    current_island = ?, updated_at = ?
                WHERE id = 1
                """,
                (
                    new_bounty,
                    new_berries,
                    new_tier.key,
                    island_for_bounty(new_bounty),
                    now_ts(),
                ),
            )

        if new_tier.key != old_tier.key:
            _emit_event(
                conn,
                "tier_up",
                {
                    "from": old_tier.key,
                    "to": new_tier.key,
                    "from_label": old_tier.label,
                    "to_label": new_tier.label,
                    "bounty": new_bounty,
                },
            )

        row = conn.execute("SELECT * FROM captain WHERE id = 1").fetchone()
        result = _row_to_dict(row)
        if new_tier.key != old_tier.key:
            result["tier_up"] = {
                "from": old_tier.label,
                "to": new_tier.label,
            }
        return result


def change_morale(delta: int) -> dict[str, Any]:
    """Add or remove morale, clamped to [0, morale_max]."""
    with connect() as conn:
        row = conn.execute("SELECT * FROM captain WHERE id = 1").fetchone()
        new_val = max(0, min(row["morale_max"], row["morale_current"] + delta))
        conn.execute(
            "UPDATE captain SET morale_current = ?, updated_at = ? WHERE id = 1",
            (new_val, now_ts()),
        )
        row = conn.execute("SELECT * FROM captain WHERE id = 1").fetchone()
        return _row_to_dict(row)


def add_treasure(
    *,
    item_name: str,
    rarity: str,
    lore_text: str | None,
    haki_bonus: str | None,
) -> int:
    """Insert a Treasure row. Returns the new id.

    If the drop is a Mythic Devil Fruit with a haki_bonus like 'buso:+2',
    we also bump the corresponding Haki stat permanently and emit a
    mythic_drop event.
    """
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO treasure (
                item_name, rarity, lore_text, haki_bonus, acquired_at, equipped
            ) VALUES (?, ?, ?, ?, ?, 0)
            """,
            (item_name, rarity, lore_text, haki_bonus, now_ts()),
        )
        new_id = cur.lastrowid
        if rarity == "mythic_devil_fruit" and haki_bonus:
            try:
                stat, amount_str = haki_bonus.split(":")
                amount = int(amount_str.replace("+", "").strip())
                if stat in ("buso", "vitality", "kenbun", "haoshoku"):
                    conn.execute(
                        f"UPDATE captain SET haki_{stat} = haki_{stat} + ?, "
                        "updated_at = ? WHERE id = 1",
                        (amount, now_ts()),
                    )
            except (ValueError, AttributeError):
                pass
            _emit_event(
                conn,
                "mythic_drop",
                {"item": item_name, "lore": lore_text, "bonus": haki_bonus},
            )
    return new_id


def emit_event(type_: str, payload: dict) -> None:
    with connect() as conn:
        _emit_event(conn, type_, payload)
