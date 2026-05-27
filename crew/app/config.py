"""Configuration for logpose-crew."""

from __future__ import annotations

from functools import cached_property
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # API
    logpose_crew_key: str = ""
    crew_internal_key: str = ""
    host: str = "0.0.0.0"
    port: int = 8325
    db_path: str = "/app/data/crew.db"

    # Upstream game backend (for captain-state skill).
    game_backend_url: str = "http://logpose-backend:8324"
    logpose_api_key: str = ""

    # Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # Read-only data sources
    obsidian_vault_path: str = "/app/obsidian"
    huberman_codex_path: str = "/app/data/huberman"

    # Proactive nudge cooldowns
    max_nudges_per_day: int = 3
    cooldown_per_crewmate_sec: int = 6 * 3600

    # Timezone
    logpose_tz: str = "Asia/Kolkata"

    # CORS for direct browser dev access
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

    @cached_property
    def obsidian_path(self) -> Path:
        return Path(self.obsidian_vault_path)

    @cached_property
    def huberman_path(self) -> Path:
        return Path(self.huberman_codex_path)


settings = Settings()
