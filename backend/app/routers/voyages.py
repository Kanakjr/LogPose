"""Voyage CRUD + completion endpoints.

POST /api/voyages                       - create
GET  /api/voyages                       - list all
GET  /api/voyages/today                 - list daily Voyages with streak + done state
GET  /api/voyages/{id}                  - single
PUT  /api/voyages/{id}                  - update
DELETE /api/voyages/{id}                - soft-deactivate
POST /api/voyages/{id}/attempt          - multipart photo or self-report attempt
"""

from __future__ import annotations

import datetime
import json
import logging
import secrets
from pathlib import Path

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app import captain as captain_mod
from app.config import settings
from app.db import connect, now_ts
from app.integrations.marine_verifier import VerifierResult, verify_photo
from app.loot import roll

router = APIRouter()
log = logging.getLogger("logpose.voyages")


HAKI_VALUES = {"buso", "vitality", "kenbun", "haoshoku"}
VERIFICATION_MODES = {"self", "marine_photo", "timer", "stillness"}
RECURRENCES = {"daily", "weekly", "one_shot"}
CATEGORIES = {"straw_hat_ritual", "crew_duty", "bounty_mission"}


class VoyageIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    description: str = ""
    haki_affinity: str
    base_bounty: int = Field(..., ge=0)
    base_berries: int = Field(..., ge=0)
    verification_mode: str
    recurrence: str
    cooldown_sec: int = Field(0, ge=0)
    category: str
    verifier_prompt: str | None = None
    active: bool = True


def _validate_enums(v: VoyageIn) -> None:
    if v.haki_affinity not in HAKI_VALUES:
        raise HTTPException(400, f"haki_affinity must be one of {sorted(HAKI_VALUES)}")
    if v.verification_mode not in VERIFICATION_MODES:
        raise HTTPException(400, f"verification_mode must be one of {sorted(VERIFICATION_MODES)}")
    if v.recurrence not in RECURRENCES:
        raise HTTPException(400, f"recurrence must be one of {sorted(RECURRENCES)}")
    if v.category not in CATEGORIES:
        raise HTTPException(400, f"category must be one of {sorted(CATEGORIES)}")


def _row(conn, voyage_id: int):
    return conn.execute("SELECT * FROM voyages WHERE id = ?", (voyage_id,)).fetchone()


def _voyage_dict(row) -> dict:
    d = dict(row)
    d["active"] = bool(d.get("active"))
    return d


def _local_date(ts: int | None = None) -> str:
    """YYYY-MM-DD in the configured local timezone."""
    if ts is None:
        ts = now_ts()
    return datetime.datetime.fromtimestamp(ts, tz=settings.zone).date().isoformat()


@router.post("/voyages")
async def create_voyage(body: VoyageIn) -> dict:
    _validate_enums(body)
    ts = now_ts()
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO voyages (
                title, description, haki_affinity, base_bounty, base_berries,
                verification_mode, recurrence, cooldown_sec, category,
                verifier_prompt, active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                body.title,
                body.description,
                body.haki_affinity,
                body.base_bounty,
                body.base_berries,
                body.verification_mode,
                body.recurrence,
                body.cooldown_sec,
                body.category,
                body.verifier_prompt,
                1 if body.active else 0,
                ts,
                ts,
            ),
        )
        new_id = cur.lastrowid
        if body.recurrence != "one_shot":
            conn.execute(
                "INSERT OR IGNORE INTO log_pose (voyage_id) VALUES (?)",
                (new_id,),
            )
        row = _row(conn, new_id)
    return _voyage_dict(row)


@router.get("/voyages")
async def list_voyages(active: bool = True) -> dict:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM voyages WHERE active = ? ORDER BY recurrence, id",
            (1 if active else 0,),
        ).fetchall()
    return {"voyages": [_voyage_dict(r) for r in rows]}


@router.get("/voyages/today")
async def voyages_today() -> dict:
    """Today's Daily Log Pose - which Voyages are due, which are done, current streak."""
    today = _local_date()
    today_start = int(
        datetime.datetime.fromisoformat(today)
        .replace(tzinfo=settings.zone)
        .timestamp()
    )
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM voyages WHERE active = 1 AND recurrence = 'daily' ORDER BY id"
        ).fetchall()
        streaks = {
            r["voyage_id"]: dict(r)
            for r in conn.execute("SELECT * FROM log_pose").fetchall()
        }
        # Map of voyage_id -> latest verified log row today
        today_done = {
            r["voyage_id"]: dict(r)
            for r in conn.execute(
                """
                SELECT * FROM voyage_log
                WHERE attempted_at >= ?
                  AND verdict IN ('verified', 'self_reported', 'timer_done')
                ORDER BY attempted_at DESC
                """,
                (today_start,),
            ).fetchall()
        }
    voyages = []
    for r in rows:
        v = _voyage_dict(r)
        st = streaks.get(v["id"], {})
        v["streak"] = {
            "current": st.get("current_streak", 0),
            "longest": st.get("longest_streak", 0),
            "last_completed_date": st.get("last_completed_date"),
        }
        done = today_done.get(v["id"])
        v["done_today"] = done is not None
        v["today_attempt"] = done
        voyages.append(v)
    return {"date": today, "voyages": voyages}


@router.get("/voyages/{voyage_id}")
async def get_voyage(voyage_id: int) -> dict:
    with connect() as conn:
        row = _row(conn, voyage_id)
    if row is None:
        raise HTTPException(404, "voyage not found")
    return _voyage_dict(row)


@router.put("/voyages/{voyage_id}")
async def update_voyage(voyage_id: int, body: VoyageIn) -> dict:
    _validate_enums(body)
    with connect() as conn:
        row = _row(conn, voyage_id)
        if row is None:
            raise HTTPException(404, "voyage not found")
        conn.execute(
            """
            UPDATE voyages SET
                title=?, description=?, haki_affinity=?, base_bounty=?,
                base_berries=?, verification_mode=?, recurrence=?,
                cooldown_sec=?, category=?, verifier_prompt=?, active=?,
                updated_at=?
            WHERE id=?
            """,
            (
                body.title,
                body.description,
                body.haki_affinity,
                body.base_bounty,
                body.base_berries,
                body.verification_mode,
                body.recurrence,
                body.cooldown_sec,
                body.category,
                body.verifier_prompt,
                1 if body.active else 0,
                now_ts(),
                voyage_id,
            ),
        )
        row = _row(conn, voyage_id)
    return _voyage_dict(row)


@router.delete("/voyages/{voyage_id}")
async def deactivate_voyage(voyage_id: int) -> dict:
    with connect() as conn:
        row = _row(conn, voyage_id)
        if row is None:
            raise HTTPException(404, "voyage not found")
        conn.execute(
            "UPDATE voyages SET active = 0, updated_at = ? WHERE id = ?",
            (now_ts(), voyage_id),
        )
    return {"ok": True, "deactivated": voyage_id}


# --------------------------------------------------------------------- attempt


def _save_image(image_bytes: bytes, suffix: str) -> str:
    """Persist the uploaded image under data/media/, return relative path."""
    safe_suffix = "".join(c for c in suffix if c.isalnum() or c in ".-_") or ".jpg"
    if not safe_suffix.startswith("."):
        safe_suffix = "." + safe_suffix
    media_root = Path(settings.media_dir)
    media_root.mkdir(parents=True, exist_ok=True)
    fname = f"{now_ts()}_{secrets.token_hex(8)}{safe_suffix}"
    p = media_root / fname
    p.write_bytes(image_bytes)
    return str(p.relative_to(media_root.parent))


def _update_streak(conn, voyage_id: int, today: str) -> dict:
    """Bump the Log Pose streak if this is the first completion today."""
    row = conn.execute(
        "SELECT * FROM log_pose WHERE voyage_id = ?", (voyage_id,)
    ).fetchone()
    if row is None:
        conn.execute(
            "INSERT INTO log_pose (voyage_id, current_streak, longest_streak, last_completed_date) "
            "VALUES (?, 1, 1, ?)",
            (voyage_id, today),
        )
        return {"current_streak": 1, "longest_streak": 1, "last_completed_date": today}
    last = row["last_completed_date"]
    current = row["current_streak"]
    longest = row["longest_streak"]
    if last == today:
        return {
            "current_streak": current,
            "longest_streak": longest,
            "last_completed_date": last,
        }
    if last is not None:
        last_d = datetime.date.fromisoformat(last)
        today_d = datetime.date.fromisoformat(today)
        delta = (today_d - last_d).days
        if delta == 1:
            current += 1
        else:
            current = 1
    else:
        current = 1
    longest = max(longest, current)
    conn.execute(
        "UPDATE log_pose SET current_streak=?, longest_streak=?, last_completed_date=? "
        "WHERE voyage_id=?",
        (current, longest, today, voyage_id),
    )
    return {
        "current_streak": current,
        "longest_streak": longest,
        "last_completed_date": today,
    }


def _apply_loot(base_berries: int) -> tuple[int, dict]:
    """Roll the drop table and figure out final berries + any treasure inserted."""
    drop = roll()
    berries = base_berries
    drop_info = {"kind": drop.kind}
    drop_item_id = None

    if drop.kind == "berries_multiplier" and drop.berries_multiplier:
        berries = int(base_berries * drop.berries_multiplier)
        drop_info["berries_multiplier"] = drop.berries_multiplier
        drop_info["bonus_berries"] = berries - base_berries
    elif drop.kind == "item":
        drop_item_id = captain_mod.add_treasure(
            item_name=drop.item_name,
            rarity=drop.rarity,
            lore_text=drop.lore_text,
            haki_bonus=drop.haki_bonus,
        )
        drop_info.update(
            {
                "rarity": drop.rarity,
                "item_name": drop.item_name,
                "lore_text": drop.lore_text,
                "haki_bonus": drop.haki_bonus,
            }
        )

    drop_info["item_id"] = drop_item_id
    return berries, drop_info


@router.post("/voyages/{voyage_id}/attempt")
async def attempt_voyage(
    voyage_id: int,
    mode: str = Form("self"),
    image: Optional[UploadFile] = File(default=None),
) -> dict:
    """Submit an attempt. Returns verdict + bounty/berries awarded + any drop.

    ``mode`` overrides the voyage default for one attempt - useful for
    timer voyages that can be self-reported when the timer naturally
    completed, or marine_photo voyages that can be self-reported in
    emergencies (this just won't earn the full bounty).
    """
    with connect() as conn:
        row = _row(conn, voyage_id)
        if row is None:
            raise HTTPException(404, "voyage not found")
        if not row["active"]:
            raise HTTPException(400, "voyage is inactive")
        voyage = _voyage_dict(row)

    effective_mode = mode or voyage["verification_mode"]
    today = _local_date()
    attempted_at = now_ts()

    verifier_result: VerifierResult | None = None
    image_path: str | None = None

    if effective_mode == "marine_photo":
        if image is None:
            raise HTTPException(400, "image required for marine_photo verification")
        data = await image.read()
        if not data:
            raise HTTPException(400, "image is empty")
        suffix = ""
        if image.filename and "." in image.filename:
            suffix = "." + image.filename.rsplit(".", 1)[1]
        image_path = _save_image(data, suffix)
        verifier_result = await verify_photo(
            image_bytes=data,
            mime_type=image.content_type or "image/jpeg",
            title=voyage["title"],
            description=voyage["description"],
            verifier_prompt=voyage.get("verifier_prompt"),
        )
        verdict = verifier_result.verdict
        reasoning = verifier_result.reasoning
        confidence = verifier_result.confidence
    elif effective_mode == "timer":
        verdict = "timer_done"
        reasoning = "Timer ran to completion."
        confidence = 1.0
    elif effective_mode == "self":
        verdict = "self_reported"
        reasoning = "Self-reported by Captain."
        confidence = 0.5
    elif effective_mode == "stillness":
        verdict = "self_reported"
        reasoning = "Stillness check passed."
        confidence = 0.8
    else:
        raise HTTPException(400, f"unsupported mode '{effective_mode}'")

    successful = verdict in ("verified", "self_reported", "timer_done")
    bounty_awarded = 0
    berries_awarded = 0
    drop_info = {"kind": "nothing"}
    captain_after = None
    streak_after = None
    tier_up = None

    if successful:
        # Self-reported on a marine_photo voyage = reduced rewards.
        if voyage["verification_mode"] == "marine_photo" and effective_mode == "self":
            scale = 0.25
        else:
            scale = 1.0
        bounty_awarded = int(voyage["base_bounty"] * scale)
        base_berries = int(voyage["base_berries"] * scale)
        berries_awarded, drop_info = _apply_loot(base_berries)

        captain_after = captain_mod.award_bounty(
            bounty=bounty_awarded,
            berries=berries_awarded,
            haki_affinity=voyage["haki_affinity"],
        )
        tier_up = captain_after.pop("tier_up", None)

        if voyage["recurrence"] != "one_shot":
            with connect() as conn:
                streak_after = _update_streak(conn, voyage_id, today)
        # Reward a small morale tick on a successful daily run.
        captain_mod.change_morale(2)

        captain_mod.emit_event(
            "voyage_completed",
            {
                "voyage_id": voyage_id,
                "title": voyage["title"],
                "verdict": verdict,
                "bounty": bounty_awarded,
                "berries": berries_awarded,
                "drop": drop_info,
            },
        )

    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO voyage_log (
                voyage_id, attempted_at, completed_at, verdict, marine_reasoning,
                confidence, bounty_awarded, berries_awarded, drop_item_id, image_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                voyage_id,
                attempted_at,
                attempted_at if successful else None,
                verdict,
                reasoning,
                confidence,
                bounty_awarded,
                berries_awarded,
                drop_info.get("item_id"),
                image_path,
            ),
        )
        log_id = cur.lastrowid

    return {
        "log_id": log_id,
        "verdict": verdict,
        "reasoning": reasoning,
        "confidence": confidence,
        "bounty_awarded": bounty_awarded,
        "berries_awarded": berries_awarded,
        "drop": drop_info,
        "captain": captain_after,
        "streak": streak_after,
        "tier_up": tier_up,
        "image_path": image_path,
    }
