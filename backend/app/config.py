"""Configuration for logpose-backend, loaded from environment variables."""

from __future__ import annotations

from functools import cached_property
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # API
    logpose_api_key: str = ""
    host: str = "0.0.0.0"
    port: int = 8324
    db_path: str = "/app/data/bounty.db"
    media_dir: str = "/app/data/media"

    # Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # Crew service (for proactive nudge webhooks)
    crew_url: str = "http://logpose-crew:8325"
    crew_internal_key: str = ""

    # Log Pose rollover hour (local time). Default 4 AM keeps late-night
    # cravings inside "today" instead of triggering a missed-daily debuff.
    rollover_hour: int = 4
    rollover_minute: int = 0

    # Timezone. Mirror asmi: avoid the bare `tz` field name because docker
    # compose injects TZ and pydantic-settings is case-insensitive.
    logpose_tz: str = "Asia/Kolkata"

    # Captain identity. The row in `captain` is single-tenant; on every boot
    # we sync it to this value so renaming via env actually sticks.
    captain_name: str = "Kanak"

    # CORS - relevant when accessed directly during local dev outside Docker
    cors_origins: str = "http://localhost:3005"

    model_config = {"env_prefix": "", "case_sensitive": False, "extra": "ignore"}

    @cached_property
    def zone(self) -> ZoneInfo:
        try:
            return ZoneInfo(self.logpose_tz)
        except ZoneInfoNotFoundError:
            return ZoneInfo("UTC")

    def cors_origins_list(self) -> list[str]:
        return [s.strip() for s in self.cors_origins.split(",") if s.strip()]


settings = Settings()
