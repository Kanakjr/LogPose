"""Log Pose rollover scheduler.

At the configured rollover time (default 04:00 local), we look at every active
Daily voyage. For each one that wasn't completed in the past 24 hours:
- Drain Crew Morale by a small amount (capped so one bad day doesn't sink you)
- Reset the streak to 0
- Emit a 'missed_daily' event (the crew service can pick this up)

We also notify the crew service over HTTP for any tier-ups / lab-risk events
that may have queued. The crew service decides whether to send a nudge.
"""

from __future__ import annotations

import datetime
import json
import logging

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app import captain as captain_mod
from app.config import settings
from app.db import connect, now_ts

log = logging.getLogger("logpose.cron")


MORALE_PER_MISSED_DAILY = 8  # cap is morale_max so this won't drop below 0
MORALE_FLOOR_DAMAGE_PER_DAY = 40  # max total drain even if many voyages missed


def _local_today() -> str:
    return datetime.datetime.now(tz=settings.zone).date().isoformat()


def _local_yesterday() -> str:
    return (datetime.datetime.now(tz=settings.zone).date() - datetime.timedelta(days=1)).isoformat()


async def daily_rollover() -> dict:
    """Walk every active daily Voyage; if not completed yesterday, punish."""
    yesterday = _local_yesterday()
    log.info("Log Pose rollover running for date=%s", yesterday)

    yesterday_start = int(
        datetime.datetime.fromisoformat(yesterday)
        .replace(tzinfo=settings.zone)
        .timestamp()
    )
    yesterday_end = yesterday_start + 86400

    missed: list[dict] = []
    with connect() as conn:
        voyages = conn.execute(
            "SELECT * FROM voyages WHERE active = 1 AND recurrence = 'daily'"
        ).fetchall()
        for v in voyages:
            done = conn.execute(
                """
                SELECT 1 FROM voyage_log
                WHERE voyage_id = ?
                  AND attempted_at >= ?
                  AND attempted_at < ?
                  AND verdict IN ('verified', 'self_reported', 'timer_done')
                LIMIT 1
                """,
                (v["id"], yesterday_start, yesterday_end),
            ).fetchone()
            if done:
                continue
            # Streak break: reset to 0 but keep longest_streak intact.
            conn.execute(
                """
                UPDATE log_pose SET current_streak = 0
                WHERE voyage_id = ?
                """,
                (v["id"],),
            )
            missed.append({"voyage_id": v["id"], "title": v["title"]})

    morale_drain = min(MORALE_FLOOR_DAMAGE_PER_DAY, len(missed) * MORALE_PER_MISSED_DAILY)
    if morale_drain > 0:
        captain_mod.change_morale(-morale_drain)

    payload = {
        "date": yesterday,
        "missed": missed,
        "morale_drain": morale_drain,
    }
    captain_mod.emit_event("missed_daily", payload)

    # Best-effort ping to the crew service so it can decide whether to nudge.
    if missed and settings.crew_url:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(
                    f"{settings.crew_url}/api/crew/event",
                    json={"type": "missed_daily", "payload": payload},
                    headers=(
                        {"x-logpose-internal": settings.crew_internal_key}
                        if settings.crew_internal_key
                        else {}
                    ),
                )
        except Exception as exc:
            log.info("crew nudge ping failed (non-fatal): %s", exc)

    return payload


def start_scheduler() -> AsyncIOScheduler:
    sched = AsyncIOScheduler(timezone=settings.zone)
    sched.add_job(
        daily_rollover,
        trigger=CronTrigger(
            hour=settings.rollover_hour,
            minute=settings.rollover_minute,
            timezone=settings.zone,
        ),
        id="log_pose_rollover",
        replace_existing=True,
    )
    sched.start()
    log.info(
        "Log Pose rollover scheduled at %02d:%02d %s",
        settings.rollover_hour,
        settings.rollover_minute,
        settings.logpose_tz,
    )
    return sched
