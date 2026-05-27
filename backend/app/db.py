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
    verification_mode   TEXT    NOT NULL,         -- self | marine_photo | timer | stillness
    recurrence          TEXT    NOT NULL,         -- daily | weekly | one_shot
    cooldown_sec        INTEGER NOT NULL DEFAULT 0,
    category            TEXT    NOT NULL,         -- straw_hat_ritual | crew_duty | bounty_mission
    verifier_prompt     TEXT,                     -- per-voyage hint for Marine Verifier
    active              INTEGER NOT NULL DEFAULT 1,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_voyages_recurrence ON voyages (recurrence, active);

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
