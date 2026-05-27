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
import hashlib
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
# `timer` and `stillness` kept here only to accept legacy clients; the actual
# completion path treats every non-`marine_photo` mode as a manual self-report.
VERIFICATION_MODES = {"self", "marine_photo", "timer", "stillness"}
RECURRENCES = {"daily", "weekly", "one_shot"}
CATEGORIES = {"straw_hat_ritual", "crew_duty", "bounty_mission"}
TIME_WINDOWS = {"morning", "midday", "evening", "night", "anytime"}


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
    icon: str | None = None
    theme_keyword: str | None = None
    time_window: str = "anytime"
    evidence_bonus_pct: int = Field(25, ge=0, le=200)
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
    if v.time_window not in TIME_WINDOWS:
        raise HTTPException(400, f"time_window must be one of {sorted(TIME_WINDOWS)}")


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
                verifier_prompt, icon, theme_keyword,
                time_window, evidence_bonus_pct,
                active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                body.icon,
                body.theme_keyword,
                body.time_window,
                body.evidence_bonus_pct,
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
                cooldown_sec=?, category=?, verifier_prompt=?,
                icon=?, theme_keyword=?,
                time_window=?, evidence_bonus_pct=?,
                active=?, updated_at=?
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
                body.icon,
                body.theme_keyword,
                body.time_window,
                body.evidence_bonus_pct,
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


def _save_evidence(
    *,
    voyage_id: int,
    image_bytes: bytes,
    suffix: str,
    captured_at: int,
    local_date: str,
    local_time: str,
) -> tuple[str, str]:
    """Persist the uploaded evidence file. Returns (relative_path, sha256).

    The path is date-bucketed (`media/YYYY-MM-DD/<voyage>_<HHMMSS>_<rand>.<ext>`)
    so the future analytics dashboard can browse a day's evidence at a
    glance without an index. Returned path is relative to media_dir's
    parent so the existing /media StaticFiles mount serves it directly.
    """
    safe_suffix = "".join(c for c in suffix if c.isalnum() or c in ".-_") or ".jpg"
    if not safe_suffix.startswith("."):
        safe_suffix = "." + safe_suffix
    media_root = Path(settings.media_dir)
    day_dir = media_root / local_date
    day_dir.mkdir(parents=True, exist_ok=True)
    fname = (
        f"voyage{voyage_id}_"
        f"{local_time.replace(':', '')}_"
        f"{secrets.token_hex(4)}{safe_suffix}"
    )
    p = day_dir / fname
    p.write_bytes(image_bytes)
    sha = hashlib.sha256(image_bytes).hexdigest()
    return str(p.relative_to(media_root.parent)), sha


def _record_evidence_media(
    *,
    voyage_id: int,
    log_id: int | None,
    captured_at: int,
    local_date: str,
    local_time: str,
    relative_path: str,
    mime_type: str | None,
    size_bytes: int,
    sha256: str,
    verdict: str | None,
    confidence: float | None,
    bonus_applied: bool,
) -> None:
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO evidence_media (
                voyage_id, log_id, captured_at, local_date, local_time, tz,
                relative_path, mime_type, size_bytes, sha256,
                verdict, confidence, bonus_applied
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                voyage_id,
                log_id,
                captured_at,
                local_date,
                local_time,
                settings.logpose_tz,
                relative_path,
                mime_type,
                size_bytes,
                sha256,
                verdict,
                confidence,
                1 if bonus_applied else 0,
            ),
        )


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
    """Mark a voyage complete. The photo is always optional.

    Reward flow:
    - Tapping "Mark complete" always earns the base bounty + berries for an
      active daily.
    - Attaching a photo runs the Marine Verifier (when the voyage has a
      `verifier_prompt`). On a `verified` or non-rejected outcome the
      Captain also earns the voyage's `evidence_bonus_pct` on top.
    - A rejected photo still completes the voyage at the base reward but
      flags `bonus_applied=false` and surfaces the rejection reasoning.

    Every uploaded image is persisted under `media/<YYYY-MM-DD>/...` with a
    sidecar `evidence_media` row (sha256, size, captured_at in Asia/Kolkata)
    so a future analytics dashboard can browse evidence by day, voyage,
    or verdict.
    """
    with connect() as conn:
        row = _row(conn, voyage_id)
        if row is None:
            raise HTTPException(404, "voyage not found")
        if not row["active"]:
            raise HTTPException(400, "voyage is inactive")
        voyage = _voyage_dict(row)

    today = _local_date()
    attempted_at = now_ts()
    local_dt = datetime.datetime.fromtimestamp(attempted_at, tz=settings.zone)
    local_date = local_dt.date().isoformat()
    local_time = local_dt.time().strftime("%H:%M:%S")

    image_bytes: bytes | None = None
    image_mime: str | None = None
    image_path: str | None = None
    image_sha: str | None = None
    image_size = 0
    verifier_result: VerifierResult | None = None

    if image is not None:
        data = await image.read()
        if not data:
            raise HTTPException(400, "image is empty")
        suffix = ""
        if image.filename and "." in image.filename:
            suffix = "." + image.filename.rsplit(".", 1)[1]
        image_bytes = data
        image_mime = image.content_type or "image/jpeg"
        image_size = len(data)
        image_path, image_sha = _save_evidence(
            voyage_id=voyage_id,
            image_bytes=data,
            suffix=suffix,
            captured_at=attempted_at,
            local_date=local_date,
            local_time=local_time,
        )
        if voyage.get("verifier_prompt"):
            verifier_result = await verify_photo(
                image_bytes=data,
                mime_type=image_mime,
                title=voyage["title"],
                description=voyage["description"],
                verifier_prompt=voyage["verifier_prompt"],
            )

    # The base verdict is always "the voyage happened". A rejected photo
    # downgrades it to self_reported (no bonus) but does NOT block completion.
    if verifier_result and verifier_result.verdict == "verified":
        verdict = "verified"
        reasoning = verifier_result.reasoning
        confidence = verifier_result.confidence
    elif verifier_result and verifier_result.verdict == "rejected":
        verdict = "self_reported"
        reasoning = (
            "Photo didn't convince the Marine Verifier - base reward only. "
            f"Reason: {verifier_result.reasoning}"
        )
        confidence = verifier_result.confidence
    elif image_bytes is not None:
        verdict = "self_reported"
        reasoning = "Photo logged - no verifier configured for this voyage."
        confidence = 0.75
    else:
        verdict = "self_reported"
        reasoning = "Self-reported by Captain."
        confidence = 0.5

    successful = verdict in ("verified", "self_reported", "timer_done")

    bounty_awarded = 0
    berries_awarded = 0
    bonus_bounty = 0
    bonus_berries = 0
    bonus_applied = False
    drop_info = {"kind": "nothing"}
    captain_after = None
    streak_after = None
    tier_up = None

    if successful:
        bounty_awarded = int(voyage["base_bounty"])
        base_berries = int(voyage["base_berries"])

        # Bonus only when the photo was attached AND the verifier didn't
        # outright reject it. Voyages without a verifier_prompt still grant
        # the bonus for any uploaded photo (an honest evidence trail).
        photo_accepted = image_bytes is not None and verdict != "self_reported_rejected"
        verifier_rejected = (
            verifier_result is not None and verifier_result.verdict == "rejected"
        )
        if image_bytes is not None and not verifier_rejected:
            pct = int(voyage.get("evidence_bonus_pct") or 0)
            if pct > 0:
                bonus_bounty = int(round(voyage["base_bounty"] * pct / 100))
                bonus_berries = int(round(voyage["base_berries"] * pct / 100))
                bounty_awarded += bonus_bounty
                base_berries += bonus_berries
                bonus_applied = True

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
                "evidence": image_path,
                "bonus_applied": bonus_applied,
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

    if image_path is not None:
        _record_evidence_media(
            voyage_id=voyage_id,
            log_id=log_id,
            captured_at=attempted_at,
            local_date=local_date,
            local_time=local_time,
            relative_path=image_path,
            mime_type=image_mime,
            size_bytes=image_size,
            sha256=image_sha or "",
            verdict=verdict,
            confidence=confidence,
            bonus_applied=bonus_applied,
        )

    return {
        "log_id": log_id,
        "verdict": verdict,
        "reasoning": reasoning,
        "confidence": confidence,
        "bounty_awarded": bounty_awarded,
        "berries_awarded": berries_awarded,
        "bonus_bounty": bonus_bounty,
        "bonus_berries": bonus_berries,
        "bonus_applied": bonus_applied,
        "evidence_bonus_pct": int(voyage.get("evidence_bonus_pct") or 0),
        "drop": drop_info,
        "captain": captain_after,
        "streak": streak_after,
        "tier_up": tier_up,
        "image_path": image_path,
    }
