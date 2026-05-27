"""Crew chat endpoints.

- GET  /api/crew                                  - list crewmates + online status
- POST /api/crew/chat                             - Den Den Mushi group chat (SSE)
- POST /api/crew/{crewmate}/chat                  - one-on-one chat (SSE)
- GET  /api/crew/{crewmate}/history?limit=        - per-thread history
- POST /api/crew/event                            - inbound webhook from game backend
- GET  /api/crew/nudges                           - pending proactive nudges
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.db import connect, now_ts
from app.llm import CREW_KEYS, stream_crew
from app.model_policy import CREW
from app.skills.runtime import captain_state_bundle, render_context_block

log = logging.getLogger("crew.chat")

router = APIRouter()


MAX_HISTORY_ROUNDS = 10
MAX_MESSAGE_CHARS = 1500


# ----------------------------------------------------------------- helpers


def _fetch_history(thread_key: str) -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT role, crewmate, content, ts
            FROM crew_chat
            WHERE thread_key = ?
            ORDER BY id DESC
            LIMIT ?
            """,
            (thread_key, MAX_HISTORY_ROUNDS * 4),
        ).fetchall()
    return [dict(r) for r in reversed(rows)]


def _history_as_rounds(raw: list[dict]) -> list[dict[str, str]]:
    """Collapse user + crew rows into one user/model round per turn."""
    history: list[dict[str, str]] = []
    pending_user: Optional[str] = None
    pending_crew: dict[str, str] = {}

    def flush():
        nonlocal pending_user, pending_crew
        if pending_user is None:
            return
        history.append({"role": "user", "content": pending_user})
        if pending_crew:
            parts = []
            for key in CREW_KEYS:
                if key in pending_crew:
                    parts.append(f"<{key}>{pending_crew[key]}</{key}>")
            if parts:
                history.append({"role": "model", "content": "\n".join(parts)})

    for r in raw:
        if r["role"] == "user":
            if pending_user is not None:
                flush()
                pending_crew = {}
            pending_user = r["content"]
            pending_crew = {}
        else:
            crew = r["crewmate"] or "luffy"
            pending_crew.setdefault(crew, r["content"])
    flush()
    return history[-(MAX_HISTORY_ROUNDS * 2):]


def _store_user(thread_key: str, content: str) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO crew_chat (thread_key, role, crewmate, content, ts) "
            "VALUES (?, 'user', NULL, ?, ?)",
            (thread_key, content, now_ts()),
        )


def _store_crew(thread_key: str, crewmate: str, content: str) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO crew_chat (thread_key, role, crewmate, content, ts) "
            "VALUES (?, 'crew', ?, ?, ?)",
            (thread_key, crewmate, content, now_ts()),
        )


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


# ----------------------------------------------------------------- listing


@router.get("/crew")
async def list_crew() -> dict:
    online = bool(settings.gemini_api_key)
    return {
        "crew": [
            {
                "key": p.key,
                "name": p.name,
                "role": p.role,
                "voice": p.voice,
                "online": online,
            }
            for p in CREW.values()
        ]
    }


@router.get("/crew/{crewmate}/history")
async def crew_history(crewmate: str, limit: int = 50) -> dict:
    if crewmate != "group" and crewmate not in CREW:
        raise HTTPException(404, "unknown crewmate")
    with connect() as conn:
        rows = conn.execute(
            "SELECT role, crewmate, content, ts FROM crew_chat "
            "WHERE thread_key = ? ORDER BY id DESC LIMIT ?",
            (crewmate, limit),
        ).fetchall()
    return {
        "thread_key": crewmate,
        "history": [dict(r) for r in reversed(rows)],
    }


# ----------------------------------------------------------------- chat


class ChatIn(BaseModel):
    message: str = Field(..., min_length=1, max_length=MAX_MESSAGE_CHARS)
    thread_key: Optional[str] = None


async def _generate_sse(
    thread_key: str,
    message: str,
    restricted_crewmate: Optional[str],
):
    raw = _fetch_history(thread_key)
    history = _history_as_rounds(raw)

    bundle = await captain_state_bundle()
    persona_skills = (
        CREW[restricted_crewmate].skills if restricted_crewmate else tuple(
            s for p in CREW.values() for s in p.skills
        )
    )
    context_block = render_context_block(bundle, persona_skills)

    _store_user(thread_key, message)

    yield _sse("start", {"thread_key": thread_key})

    buffers: dict[str, list[str]] = {}
    actions: dict[str, str] = {}
    cap_after: dict | None = None

    try:
        async for ev in stream_crew(
            history=history,
            user_message=message,
            context_block=context_block,
            restricted_crewmate=restricted_crewmate,
        ):
            kind = ev[0]
            if kind == "agent_start":
                agent = ev[1]
                buffers.setdefault(agent, [])
                yield _sse("agent_start", {"agent": agent})
            elif kind == "token":
                agent, text = ev[1], ev[2]
                buffers.setdefault(agent, []).append(text)
                yield _sse("token", {"agent": agent, "text": text})
                await asyncio.sleep(0)
            elif kind == "agent_end":
                agent = ev[1]
                final = "".join(buffers.get(agent, [])).strip()
                if agent in CREW:
                    if final:
                        _store_crew(thread_key, agent, final)
                    yield _sse(
                        "agent_end",
                        {"agent": agent, "length": len(final)},
                    )
                else:
                    actions[agent] = final
            elif kind == "done":
                pass
    except Exception as exc:
        log.warning("crew stream errored: %s", exc)
        yield _sse("error", {"message": "Den Den Mushi cut out."})

    for action_name, payload in actions.items():
        yield _sse("action", {"name": action_name, "payload": payload})

    yield _sse("end", {"agents": list(buffers.keys()), "actions": list(actions.keys())})


@router.post("/crew/chat")
async def group_chat(body: ChatIn) -> StreamingResponse:
    thread_key = body.thread_key or "group"
    return StreamingResponse(
        _generate_sse(thread_key, body.message, restricted_crewmate=None),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/crew/{crewmate}/chat")
async def one_on_one(crewmate: str, body: ChatIn) -> StreamingResponse:
    if crewmate not in CREW:
        raise HTTPException(404, "unknown crewmate")
    thread_key = body.thread_key or crewmate
    return StreamingResponse(
        _generate_sse(thread_key, body.message, restricted_crewmate=crewmate),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ----------------------------------------------------------------- one-liner
#
# Tiny non-persistent endpoint used by the UI after a successful voyage to
# pull a single ~one-sentence quip from the appropriate crewmate. It does
# NOT write to crew_chat (these aren't conversations, they're rewards) and
# it imposes a hard 50-token cap on the model to keep latency low.


class OneLinerIn(BaseModel):
    intent: str = Field(..., min_length=1, max_length=64)
    payload: dict = Field(default_factory=dict)


@router.post("/crew/{crewmate}/one_liner")
async def crew_one_liner(crewmate: str, body: OneLinerIn) -> dict:
    if crewmate not in CREW:
        raise HTTPException(404, "unknown crewmate")
    if not settings.gemini_api_key:
        return {"crewmate": crewmate, "content": _fallback_one_liner(crewmate, body.intent)}

    bundle = await captain_state_bundle()
    persona_skills = CREW[crewmate].skills
    context_block = render_context_block(bundle, persona_skills)

    # Compose a single short user message that hints at the intent.
    if body.intent == "victory":
        title = str(body.payload.get("title") or "a voyage")
        user_msg = (
            f"Captain just cleared '{title}'. Reply in ONE short sentence, "
            "in your voice. No quest names, no stat numbers, no salutation."
        )
    else:
        user_msg = (
            f"Intent: {body.intent}. Reply in ONE short sentence in your "
            "voice. No salutation, no list of options."
        )

    from app.llm import _get_client  # local import to avoid circulars

    try:
        from google.genai import types as genai_types

        client = _get_client()
        # Build a tiny persona-only system prompt so we keep cost low.
        from app.llm import _PROMPTS_DIR

        persona_md = (_PROMPTS_DIR / f"crew/{crewmate}.md").read_text(encoding="utf-8")
        system = (
            persona_md
            + "\n\n# Rule\nReply in ONE short sentence. No tags, no actions, "
            "no salutations, no lists. Just a single line of voice."
            + "\n\n" + context_block
        )
        resp = await asyncio.to_thread(
            client.models.generate_content,
            model=settings.gemini_model,
            contents=[
                genai_types.Content(
                    role="user",
                    parts=[genai_types.Part.from_text(text=user_msg)],
                )
            ],
            config=genai_types.GenerateContentConfig(
                system_instruction=system,
                temperature=0.9,
                thinking_config=genai_types.ThinkingConfig(thinking_budget=0),
                max_output_tokens=80,
            ),
        )
        text = (getattr(resp, "text", None) or "").strip()
        if not text:
            text = _fallback_one_liner(crewmate, body.intent)
        # Strip any stray tagged blocks the model might have emitted.
        text = _strip_tags(text)
        return {"crewmate": crewmate, "content": text}
    except Exception as exc:
        log.warning("one_liner failed: %s", exc)
        return {"crewmate": crewmate, "content": _fallback_one_liner(crewmate, body.intent)}


_TAG_RE = None


def _strip_tags(s: str) -> str:
    import re as _re

    global _TAG_RE
    if _TAG_RE is None:
        _TAG_RE = _re.compile(r"</?[a-z_][a-z_0-9]*>", _re.IGNORECASE)
    return _TAG_RE.sub("", s).strip()


def _fallback_one_liner(crewmate: str, intent: str) -> str:
    if intent != "victory":
        return "Aye."
    # Offline / API-down fallback so the UI never shows blank.
    return {
        "luffy": "Yosh! Keep going!",
        "zoro": "Good. Again tomorrow.",
        "nami": "Logged. The course holds.",
        "robin": "Consistency compounds.",
        "chopper": "Nice. Tiny win, real impact.",
    }.get(crewmate, "Nice work.")


# ----------------------------------------------------------------- nudges


class EventIn(BaseModel):
    type: str
    payload: dict


# Crewmate routing for proactive events.
_EVENT_TO_CREWMATE = {
    "missed_daily": "luffy",
    "tier_up": "luffy",
    "lab_risk": "chopper",
    "mythic_drop": "nami",
}


def _allowed_by_cooldown(crewmate: str) -> bool:
    cutoff = now_ts() - settings.cooldown_per_crewmate_sec
    today_start = now_ts() - 86400
    with connect() as conn:
        recent_for_crew = conn.execute(
            "SELECT COUNT(*) AS c FROM nudge_log WHERE crewmate = ? AND ts > ?",
            (crewmate, cutoff),
        ).fetchone()["c"]
        today_total = conn.execute(
            "SELECT COUNT(*) AS c FROM nudge_log WHERE ts > ?",
            (today_start,),
        ).fetchone()["c"]
    if recent_for_crew >= 1:
        return False
    if today_total >= settings.max_nudges_per_day:
        return False
    return True


def _nudge_text(event_type: str, payload: dict) -> str:
    if event_type == "missed_daily":
        n = len(payload.get("missed", []))
        return f"You missed {n} daily voyage{'s' if n != 1 else ''} yesterday. Get up. We're sailing."
    if event_type == "tier_up":
        return f"Yosh! You went from {payload.get('from_label')} to {payload.get('to_label')}!"
    if event_type == "lab_risk":
        return payload.get("note") or "Something flagged risky in today's log."
    if event_type == "mythic_drop":
        return f"You pulled a {payload.get('item')}! That's MY cut, by the way."
    return "..."


@router.post("/crew/event")
async def receive_event(body: EventIn) -> dict:
    crewmate = _EVENT_TO_CREWMATE.get(body.type)
    if not crewmate:
        return {"ok": True, "skipped": "unknown type"}
    if not _allowed_by_cooldown(crewmate):
        return {"ok": True, "skipped": "cooldown"}
    text = _nudge_text(body.type, body.payload)
    with connect() as conn:
        conn.execute(
            "INSERT INTO nudge_log (crewmate, reason, content, ts) "
            "VALUES (?, ?, ?, ?)",
            (crewmate, body.type, text, now_ts()),
        )
    return {"ok": True, "crewmate": crewmate, "content": text}


@router.get("/crew/nudges")
async def pending_nudges() -> dict:
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, crewmate, reason, content, ts FROM nudge_log "
            "WHERE delivered = 0 ORDER BY ts DESC LIMIT 20"
        ).fetchall()
        if rows:
            ids = [r["id"] for r in rows]
            placeholder = ",".join("?" * len(ids))
            conn.execute(
                f"UPDATE nudge_log SET delivered = 1 WHERE id IN ({placeholder})",
                tuple(ids),
            )
    return {
        "nudges": [
            {
                "crewmate": r["crewmate"],
                "reason": r["reason"],
                "content": r["content"],
                "ts": r["ts"],
            }
            for r in rows
        ]
    }
