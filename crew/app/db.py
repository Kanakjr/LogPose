"""crew.db - persistent chat history and nudge cooldowns."""

from __future__ import annotations

import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from app.config import settings


SCHEMA = """
-- One row per chat message.
-- thread_key is the conversation id; for one-on-one chats we use the
-- crewmate name (e.g. 'luffy'), for the Den Den Mushi group we use 'group'.
CREATE TABLE IF NOT EXISTS crew_chat (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_key  TEXT    NOT NULL,
    role        TEXT    NOT NULL,             -- 'user' | 'crew'
    crewmate    TEXT,                          -- for crew rows; null for user
    content     TEXT    NOT NULL,
    ts          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_crew_chat_thread ON crew_chat (thread_key, id);

-- Cooldown tracking for proactive nudges.
CREATE TABLE IF NOT EXISTS nudge_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    crewmate    TEXT    NOT NULL,
    reason      TEXT    NOT NULL,
    content     TEXT    NOT NULL,
    ts          INTEGER NOT NULL,
    delivered   INTEGER NOT NULL DEFAULT 0    -- has the UI fetched/seen it
);
CREATE INDEX IF NOT EXISTS idx_nudge_log_ts ON nudge_log (ts DESC);
CREATE INDEX IF NOT EXISTS idx_nudge_log_crew ON nudge_log (crewmate, ts DESC);
"""


def init_db() -> None:
    Path(settings.db_path).parent.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.executescript(SCHEMA)


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
