"""Skill execution helpers.

These are the actual tool functions backing the SKILL.md files. The
orchestrator selects which tools to call by name based on the persona's skill
pack (model_policy.CREW[*].skills) plus the always-available shared skills
captain-state and huberman-codex.

Tools are designed to be called once before the LLM generation and the result
stuffed into the system instruction. Cheap and bounded - no fan-out, no loops.
"""

from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx

from app.config import settings

log = logging.getLogger("crew.skills")


# --- captain-state (always-available) ---------------------------------------


def _game_headers() -> dict[str, str]:
    if settings.logpose_api_key:
        return {"x-logpose-key": settings.logpose_api_key}
    return {}


async def _game_get(path: str) -> Any:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                f"{settings.game_backend_url}{path}", headers=_game_headers()
            )
            r.raise_for_status()
            return r.json()
    except Exception as exc:
        log.info("game backend call failed (%s): %s", path, exc)
        return None


async def get_captain() -> dict | None:
    return await _game_get("/api/captain")


async def list_voyages_today() -> dict | None:
    return await _game_get("/api/voyages/today")


async def list_recent_log(days: int = 7) -> list[dict]:
    data = await _game_get(f"/api/journal?limit={days * 6}")
    if not data:
        return []
    return data.get("items", [])


async def get_treasure() -> dict | None:
    return await _game_get("/api/treasure")


# --- obsidian-brain ---------------------------------------------------------


def _safe_obsidian_path(rel: str) -> Path | None:
    root = settings.obsidian_path.resolve()
    candidate = (root / rel).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        return None
    return candidate


def obsidian_list_directories() -> list[str]:
    root = settings.obsidian_path
    if not root.exists():
        return []
    return sorted(d.name for d in root.iterdir() if d.is_dir())


def obsidian_search_notes(query: str, limit: int = 5) -> list[dict]:
    """Cheap substring search across .md files."""
    root = settings.obsidian_path
    if not root.exists():
        return []
    q = query.lower().strip()
    if not q:
        return []
    results: list[dict] = []
    for p in root.rglob("*.md"):
        try:
            content = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        if q in content.lower() or q in p.name.lower():
            snippet = ""
            idx = content.lower().find(q)
            if idx >= 0:
                start = max(0, idx - 80)
                end = min(len(content), idx + 160)
                snippet = content[start:end].replace("\n", " ")
            else:
                snippet = content[:200].replace("\n", " ")
            results.append(
                {
                    "path": str(p.relative_to(root)),
                    "snippet": snippet,
                }
            )
            if len(results) >= limit:
                break
    return results


def obsidian_read_note(relative_path: str) -> str | None:
    p = _safe_obsidian_path(relative_path)
    if p is None or not p.exists() or not p.is_file():
        return None
    try:
        return p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return None


# --- medical / Chopper -----------------------------------------------------


_HEALTH_SUMMARY_RE = re.compile(r"health\s*summary", re.IGNORECASE)
_ME_NOTE_RE = re.compile(r"^(me|about[\s_-]*me|profile)$", re.IGNORECASE)


def read_health_summary() -> str | None:
    """Find and read the most recent Health Summary*.md note."""
    root = settings.obsidian_path
    if not root.exists():
        return None
    candidates: list[Path] = []
    for p in root.rglob("*.md"):
        if _HEALTH_SUMMARY_RE.search(p.stem):
            candidates.append(p)
    if not candidates:
        return None
    # Most recently modified
    candidates.sort(key=lambda x: x.stat().st_mtime, reverse=True)
    try:
        return candidates[0].read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return None


def read_captain_bio() -> str | None:
    """Locate the Captain's canonical bio note (me.md / about-me.md) in the
    Obsidian vault. The crew reads this on every reply so it always knows
    who it's talking to.
    """
    root = settings.obsidian_path
    if not root.exists():
        return None
    for p in root.rglob("*.md"):
        if _ME_NOTE_RE.match(p.stem):
            try:
                return p.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                return None
    return None


async def meds_check(today_iso: str | None = None) -> str:
    today_iso = today_iso or datetime.now(tz=settings.zone).date().isoformat()
    today = await list_voyages_today()
    if not today:
        return "unknown"
    for v in today.get("voyages", []):
        if "thyronorm" in v["title"].lower():
            return "taken" if v.get("done_today") else "missed"
    return "unknown"


# --- huberman-codex (always-available) -------------------------------------


def codex_list() -> list[str]:
    root = settings.huberman_path
    if not root.exists():
        return []
    return sorted(p.stem for p in root.glob("*.md"))


def codex_search(query: str, limit: int = 3) -> list[dict]:
    root = settings.huberman_path
    if not root.exists():
        return []
    q = query.lower().strip()
    if not q:
        return []
    results: list[dict] = []
    for p in root.glob("*.md"):
        text = p.read_text(encoding="utf-8", errors="ignore")
        if q in text.lower() or q in p.stem.lower():
            snippet = ""
            idx = text.lower().find(q)
            if idx >= 0:
                start = max(0, idx - 80)
                end = min(len(text), idx + 240)
                snippet = text[start:end]
            else:
                snippet = text[:300]
            results.append({"slug": p.stem, "snippet": snippet.strip()})
            if len(results) >= limit:
                break
    return results


def codex_read(slug: str) -> str | None:
    root = settings.huberman_path
    if not root.exists():
        return None
    p = root / f"{slug}.md"
    if not p.exists() or not p.is_file():
        return None
    return p.read_text(encoding="utf-8", errors="ignore")


# --- compact context bundling for the LLM ----------------------------------


async def captain_state_bundle() -> dict:
    """One call that fetches every always-on context block and returns a
    compact dict suitable for stuffing into the system instruction.
    """
    captain = await get_captain()
    today = await list_voyages_today()
    recent = await list_recent_log(days=3)
    bundle: dict = {}
    if captain:
        bundle["captain"] = {
            "name": captain.get("name"),
            "bounty": captain.get("bounty_display"),
            "bounty_tier": captain.get("tier", {}).get("label"),
            "berries": captain.get("berries"),
            "morale": captain.get("morale"),
            "haki": {k: v.get("level") for k, v in captain.get("haki", {}).items()},
            "current_island": captain.get("current_island"),
            "next_island": captain.get("next_island"),
        }
    if today:
        voyages = today.get("voyages", [])
        done = sum(1 for v in voyages if v.get("done_today"))
        bundle["today"] = {
            "date": today.get("date"),
            "done": done,
            "total": len(voyages),
            "voyages": [
                {
                    "title": v["title"],
                    "haki": v["haki_affinity"],
                    "done_today": bool(v.get("done_today")),
                    "streak": (v.get("streak") or {}).get("current", 0),
                }
                for v in voyages
            ],
        }
    bundle["recent_log"] = [
        {
            "title": r.get("title"),
            "verdict": r.get("verdict"),
            "ts": r.get("attempted_at"),
        }
        for r in recent[:10]
    ]
    return bundle


def render_context_block(bundle: dict, persona_skills: tuple[str, ...]) -> str:
    """Turn the dict into a small Markdown block to inject as system context."""
    lines: list[str] = []

    # Captain bio - always-on. Sourced from `me.md` in the Obsidian vault so
    # the Captain owns the content. Trimmed to a reasonable size to keep the
    # system instruction cheap.
    bio = read_captain_bio()
    if bio:
        snippet = bio.strip()
        if len(snippet) > 1800:
            snippet = snippet[:1800].rstrip() + "\n... [truncated]"
        lines.append("## Who you're talking to")
        lines.append(snippet)
        lines.append("")

    cap = bundle.get("captain")
    if cap:
        lines.append("## Captain state")
        lines.append(f"- Name: {cap.get('name')}")
        lines.append(f"- Bounty: {cap.get('bounty')} ({cap.get('bounty_tier')})")
        lines.append(f"- Berries: {cap.get('berries')}")
        morale = cap.get("morale") or {}
        lines.append(f"- Crew Morale: {morale.get('current')}/{morale.get('max')}")
        haki = cap.get("haki") or {}
        lines.append(
            "- Haki: "
            + ", ".join(f"{k} L{v}" for k, v in haki.items())
        )
        lines.append(f"- Current island: {cap.get('current_island')}")
        ni = cap.get("next_island") or {}
        if ni:
            lines.append(f"- Next island: {ni.get('name')} ({ni.get('threshold'):,})")
    today = bundle.get("today")
    if today:
        lines.append("")
        lines.append(f"## Today's Log Pose ({today.get('done')}/{today.get('total')} cleared)")
        for v in today.get("voyages", []):
            status = "DONE" if v["done_today"] else "open"
            streak = f"streak {v['streak']}" if v["streak"] else "no streak"
            lines.append(
                f"- [{status}] {v['title']} ({v['haki']}, {streak})"
            )
    recent = bundle.get("recent_log") or []
    if recent:
        lines.append("")
        lines.append("## Last few attempts")
        for r in recent[:6]:
            ts_str = (
                datetime.fromtimestamp(r["ts"], tz=settings.zone).strftime("%a %H:%M")
                if r.get("ts")
                else "?"
            )
            lines.append(f"- {ts_str} - {r.get('title')}: {r.get('verdict')}")

    # Optional: drop in the Health Summary for personas with the medical skill.
    if "medical" in persona_skills or "obsidian-brain" in persona_skills:
        hs = read_health_summary()
        if hs:
            preview = hs[:1500]
            lines.append("")
            lines.append("## Latest Health Summary excerpt (Obsidian)")
            lines.append("```")
            lines.append(preview)
            if len(hs) > 1500:
                lines.append("... [truncated]")
            lines.append("```")

    return "\n".join(lines) if lines else "(no context available)"
