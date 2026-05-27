"""Hand-rolled SQLite layer for LogPose.

Mirrors asmi's pattern - no SQLAlchemy, just sqlite3 + a context manager.
Schema is themed: captain, voyages, voyage_log, treasure, log_pose, events.
"""

from __future__ import annotations

import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from app.config import settings


SCHEMA = """
-- The single Captain (one row). RPG stats use Haki naming.
CREATE TABLE IF NOT EXISTS captain (
    id                INTEGER PRIMARY KEY CHECK (id = 1),
    name              TEXT    NOT NULL DEFAULT 'Captain',
    bounty            INTEGER NOT NULL DEFAULT 0,
    morale_current    INTEGER NOT NULL DEFAULT 100,
    morale_max        INTEGER NOT NULL DEFAULT 100,
    haki_buso         INTEGER NOT NULL DEFAULT 1,
    haki_vitality     INTEGER NOT NULL DEFAULT 1,
    haki_kenbun       INTEGER NOT NULL DEFAULT 1,
    haki_haoshoku     INTEGER NOT NULL DEFAULT 1,
    bounty_tier       TEXT    NOT NULL DEFAULT 'rookie',
    berries           INTEGER NOT NULL DEFAULT 0,
    current_island    TEXT    NOT NULL DEFAULT 'East Blue',
    updated_at        INTEGER NOT NULL
);

-- A Voyage is a quest definition. Daily Log Pose voyages recur every day.
CREATE TABLE IF NOT EXISTS voyages (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    title               TEXT    NOT NULL,
    description         TEXT    NOT NULL DEFAULT '',
    haki_affinity       TEXT    NOT NULL,         -- buso | vitality | kenbun | haoshoku
    base_bounty         INTEGER NOT NULL,
    base_berries        INTEGER NOT NULL,
    verification_mode   TEXT    NOT NULL,         -- self | marine_photo (timer is legacy; treated as self)
    recurrence          TEXT    NOT NULL,         -- daily | weekly | one_shot
    cooldown_sec        INTEGER NOT NULL DEFAULT 0,
    category            TEXT    NOT NULL,         -- straw_hat_ritual | crew_duty | bounty_mission
    verifier_prompt     TEXT,                     -- per-voyage hint for Marine Verifier (used when photo is provided)
    icon                TEXT,                     -- voyage icon key (see ui/src/lib/sprites.ts VoyageIcon)
    theme_keyword       TEXT,                     -- short tag for sorting/filtering ("sleep", "movement", etc.)
    time_window         TEXT    NOT NULL DEFAULT 'anytime',  -- morning | midday | evening | night | anytime
    evidence_bonus_pct  INTEGER NOT NULL DEFAULT 25,         -- % bonus on top of base reward when a photo is provided
    active              INTEGER NOT NULL DEFAULT 1,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_voyages_recurrence ON voyages (recurrence, active);
CREATE INDEX IF NOT EXISTS idx_voyages_time_window ON voyages (time_window, active);

-- Every attempt at a voyage (verified or not, complete or not).
CREATE TABLE IF NOT EXISTS voyage_log (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    voyage_id           INTEGER NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
    attempted_at        INTEGER NOT NULL,
    completed_at        INTEGER,
    verdict             TEXT    NOT NULL,         -- pending | verified | rejected | self_reported | timer_done
    marine_reasoning    TEXT,
    confidence          REAL,
    bounty_awarded      INTEGER NOT NULL DEFAULT 0,
    berries_awarded     INTEGER NOT NULL DEFAULT 0,
    drop_item_id        INTEGER REFERENCES treasure(id),
    image_path          TEXT
);
CREATE INDEX IF NOT EXISTS idx_voyage_log_voyage ON voyage_log (voyage_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_voyage_log_attempt ON voyage_log (attempted_at DESC);

-- Treasure Chest = inventory of items rolled on the loot table.
CREATE TABLE IF NOT EXISTS treasure (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name           TEXT    NOT NULL,
    rarity              TEXT    NOT NULL,         -- common | rare_cursed_blade | legendary_ancient_weapon | mythic_devil_fruit
    lore_text           TEXT,
    haki_bonus          TEXT,                     -- e.g. 'buso:+2' for mythic stat bonuses
    acquired_at         INTEGER NOT NULL,
    equipped            INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_treasure_rarity ON treasure (rarity, acquired_at DESC);

-- Streaks per voyage. One row per recurring voyage.
CREATE TABLE IF NOT EXISTS log_pose (
    voyage_id           INTEGER PRIMARY KEY REFERENCES voyages(id) ON DELETE CASCADE,
    current_streak      INTEGER NOT NULL DEFAULT 0,
    longest_streak      INTEGER NOT NULL DEFAULT 0,
    last_completed_date TEXT                       -- YYYY-MM-DD local
);

-- Long-lived metadata for every uploaded evidence photo. Drives the future
-- analytics dashboard ("show me my Sanji's Meal plates for the last 30 days",
-- "how often did I produce evidence vs self-report") so we keep this even if
-- a voyage_log row is later pruned.
CREATE TABLE IF NOT EXISTS evidence_media (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    voyage_id       INTEGER NOT NULL REFERENCES voyages(id) ON DELETE CASCADE,
    log_id          INTEGER REFERENCES voyage_log(id) ON DELETE SET NULL,
    captured_at     INTEGER NOT NULL,           -- unix epoch seconds (UTC)
    local_date      TEXT    NOT NULL,           -- YYYY-MM-DD in the configured tz
    local_time      TEXT    NOT NULL,           -- HH:MM:SS in the configured tz
    tz              TEXT    NOT NULL,           -- e.g. "Asia/Kolkata"
    relative_path   TEXT    NOT NULL,           -- relative to media_root (parent of media_dir)
    mime_type       TEXT,
    size_bytes      INTEGER NOT NULL DEFAULT 0,
    sha256          TEXT,
    verdict         TEXT,                       -- verified | rejected | self_reported | timer_done
    confidence      REAL,
    bonus_applied   INTEGER NOT NULL DEFAULT 0  -- 1 if the +pct bonus was awarded
);
CREATE INDEX IF NOT EXISTS idx_evidence_voyage_date ON evidence_media (voyage_id, local_date);
CREATE INDEX IF NOT EXISTS idx_evidence_local_date ON evidence_media (local_date DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_captured ON evidence_media (captured_at DESC);

-- Append-only event stream for analytics and crew webhooks.
CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ts          INTEGER NOT NULL,
    type        TEXT    NOT NULL,                  -- voyage_completed | tier_up | missed_daily | mythic_drop | lab_risk
    payload     TEXT    NOT NULL                   -- JSON blob
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events (ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON events (type, ts DESC);
"""


def init_db() -> None:
    Path(settings.db_path).parent.mkdir(parents=True, exist_ok=True)
    Path(settings.media_dir).mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.executescript(SCHEMA)
        _ensure_voyage_columns(conn)
        row = conn.execute("SELECT id, name FROM captain WHERE id = 1").fetchone()
        if row is None:
            conn.execute(
                "INSERT INTO captain (id, name, updated_at) VALUES (1, ?, ?)",
                (settings.captain_name, now_ts()),
            )
        elif row["name"] != settings.captain_name:
            # Env-driven rename. Cheap to run on every boot.
            conn.execute(
                "UPDATE captain SET name = ?, updated_at = ? WHERE id = 1",
                (settings.captain_name, now_ts()),
            )


def _ensure_voyage_columns(conn: sqlite3.Connection) -> None:
    """Lightweight migrations: add columns that didn't exist in earlier
    schemas. SQLite can't add columns via CREATE TABLE IF NOT EXISTS, so we
    PRAGMA the table_info and ALTER if needed. Defaults are set so any row
    inserted before the migration still satisfies the new contract.
    """
    existing = {
        row["name"]
        for row in conn.execute("PRAGMA table_info(voyages)").fetchall()
    }
    if "icon" not in existing:
        conn.execute("ALTER TABLE voyages ADD COLUMN icon TEXT")
    if "theme_keyword" not in existing:
        conn.execute("ALTER TABLE voyages ADD COLUMN theme_keyword TEXT")
    if "time_window" not in existing:
        conn.execute(
            "ALTER TABLE voyages ADD COLUMN time_window TEXT NOT NULL DEFAULT 'anytime'"
        )
    if "evidence_bonus_pct" not in existing:
        conn.execute(
            "ALTER TABLE voyages ADD COLUMN evidence_bonus_pct INTEGER NOT NULL DEFAULT 25"
        )


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(settings.db_path, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    try:
        yield conn
    finally:
        conn.close()


def now_ts() -> int:
    return int(time.time())
