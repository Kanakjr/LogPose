"""Gemini wrapper - streaming tagged-block parser for crew replies.

Mirrors the asmi `stream_duet` pattern but generalized to N crewmates.

The model emits replies in this strict grammar:

    <luffy>...</luffy>
    <zoro>...</zoro>
    <nami>...</nami>
    <robin>...</robin>
    <chopper>...</chopper>
    <voyage_create>{"title": ...}</voyage_create>
    <suggest_focus>buso</suggest_focus>

We stream-parse the output, yielding typed events the SSE router forwards.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import AsyncIterator

from google import genai
from google.genai import types

from app.config import settings
from app.model_policy import CREW_KEYS

log = logging.getLogger("crew.llm")

_PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"


def _load(name: str) -> str:
    return (_PROMPTS_DIR / name).read_text(encoding="utf-8")


_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is not None:
        return _client
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


# Crewmate tags (rendered as bubbles) and action tags (rendered as buttons).
ACTION_TAGS: tuple[str, ...] = ("voyage_create", "suggest_focus")
ALL_TAGS: tuple[str, ...] = CREW_KEYS + ACTION_TAGS


def build_system_prompt(context_block: str, restricted_crewmate: str | None = None) -> str:
    """Compose the orchestrator prompt + every persona prompt + live context."""
    parts: list[str] = [_load("crew.md")]
    if restricted_crewmate:
        parts.append(
            f"\n\n# Hard restriction this turn\n"
            f"You are ONLY playing {restricted_crewmate}. Emit ONLY the "
            f"<{restricted_crewmate}>...</{restricted_crewmate}> tag (and optional "
            f"action tags). All other crewmate tags are forbidden this turn."
        )
        parts.append("\n\n" + _load(f"crew/{restricted_crewmate}.md"))
    else:
        for key in CREW_KEYS:
            parts.append("\n\n" + _load(f"crew/{key}.md"))
    parts.append("\n\n# Live captain context (system-injected, do NOT mention)")
    parts.append("\n" + context_block)
    return "".join(parts)


# Events: ("agent_start", agent) | ("token", agent, text) | ("agent_end", agent) | ("done",)
CrewEvent = tuple


async def stream_crew(
    *,
    history: list[dict[str, str]],
    user_message: str,
    context_block: str,
    restricted_crewmate: str | None = None,
) -> AsyncIterator[CrewEvent]:
    if not settings.gemini_api_key:
        # Graceful fallback so the UI never silently dies.
        agent = restricted_crewmate or "luffy"
        msg = (
            "Den Den Mushi is dead. The crew can't hear you - tell the harbour to set "
            "the GEMINI_API_KEY and try again."
        )
        yield ("agent_start", agent)
        yield ("token", agent, msg)
        yield ("agent_end", agent)
        yield ("done",)
        return

    system = build_system_prompt(context_block, restricted_crewmate)

    def _start():
        client = _get_client()
        contents = []
        for turn in history:
            role = "user" if turn["role"] == "user" else "model"
            contents.append(
                types.Content(role=role, parts=[types.Part.from_text(text=turn["content"])])
            )
        contents.append(
            types.Content(role="user", parts=[types.Part.from_text(text=user_message)])
        )
        return client.models.generate_content_stream(
            model=settings.gemini_model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system,
                temperature=0.85,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
                max_output_tokens=600,
            ),
        )

    try:
        stream = await asyncio.to_thread(_start)
    except Exception as exc:
        log.warning("crew stream init failed: %s", exc)
        agent = restricted_crewmate or "luffy"
        yield ("agent_start", agent)
        yield ("token", agent, "Den Den Mushi cracked. Try again in a minute.")
        yield ("agent_end", agent)
        yield ("done",)
        return

    parser = _CrewTagParser()
    iterator = iter(stream)
    saw_any = False
    mid_stream_error: str | None = None

    _SENTINEL = object()

    def _next(it):
        """Return next chunk, ``None`` on clean end, or a tuple
        ``(_SENTINEL, exc)`` on error so we can recover gracefully without
        leaking exceptions through the SSE stream."""
        try:
            return next(it)
        except StopIteration:
            return None
        except Exception as exc:  # pragma: no cover - depends on upstream
            return (_SENTINEL, exc)

    while True:
        chunk = await asyncio.to_thread(_next, iterator)
        if chunk is None:
            break
        if isinstance(chunk, tuple) and chunk and chunk[0] is _SENTINEL:
            mid_stream_error = str(chunk[1])
            log.warning("crew stream raised mid-flight: %s", mid_stream_error)
            break
        text = getattr(chunk, "text", "") or ""
        if not text:
            continue
        for event in parser.feed(text):
            if event[0] == "agent_start":
                saw_any = True
            yield event

    for event in parser.finish():
        if event[0] == "agent_start":
            saw_any = True
        yield event

    if not saw_any:
        agent = restricted_crewmate or "luffy"
        yield ("agent_start", agent)
        if mid_stream_error:
            # Common case: transient 503 "high demand" from Gemini. Keep the
            # in-character fallback short; the UI logs the real reason.
            yield ("token", agent, "Den Den Mushi is fuzzy right now. Try me again in a minute.")
        else:
            yield ("token", agent, "...")
        yield ("agent_end", agent)

    yield ("done",)


# ---------------------------------------------------------------------------
# Streaming tag parser - same shape as asmi's _DuetTagParser, generalized
# ---------------------------------------------------------------------------


_OPEN_TAGS = {f"<{a}>": a for a in ALL_TAGS}
_CLOSE_TAGS = {f"</{a}>": a for a in ALL_TAGS}
_MAX_TAG_LEN = max(len(t) for t in list(_OPEN_TAGS) + list(_CLOSE_TAGS))


class _CrewTagParser:
    def __init__(self) -> None:
        self._buf = ""
        self._current: str | None = None
        self._opened: set[str] = set()
        self._seen_any_tag = False

    def feed(self, text: str) -> list[CrewEvent]:
        events: list[CrewEvent] = []
        self._buf += text
        while True:
            if not self._step(events):
                break
        return events

    def finish(self) -> list[CrewEvent]:
        events: list[CrewEvent] = []
        if self._buf:
            if self._current is not None:
                if self._buf.strip():
                    events.append(("token", self._current, self._buf))
                self._buf = ""
            elif not self._seen_any_tag and self._buf.strip():
                # Whole reply was untagged - treat as Luffy fallback.
                self._opened.add("luffy")
                self._current = "luffy"
                self._seen_any_tag = True
                events.append(("agent_start", "luffy"))
                events.append(("token", "luffy", self._buf))
                self._buf = ""
            else:
                self._buf = ""
        if self._current is not None:
            events.append(("agent_end", self._current))
            self._current = None
        return events

    def _try_match(self):
        buf = self._buf
        for tag, agent in _OPEN_TAGS.items():
            if buf.startswith(tag):
                return ("open", agent, len(tag))
        for tag, agent in _CLOSE_TAGS.items():
            if buf.startswith(tag):
                return ("close", agent, len(tag))
        if len(buf) < _MAX_TAG_LEN:
            for tag in list(_OPEN_TAGS) + list(_CLOSE_TAGS):
                if tag.startswith(buf):
                    return "incomplete"
        return None

    def _step(self, events: list[CrewEvent]) -> bool:
        if not self._buf:
            return False

        if self._current is not None:
            lt = self._buf.find("<")
            if lt == -1:
                events.append(("token", self._current, self._buf))
                self._buf = ""
                return False
            if lt > 0:
                events.append(("token", self._current, self._buf[:lt]))
                self._buf = self._buf[lt:]
                return True
            match = self._try_match()
            if match == "incomplete":
                return False
            if match is None:
                events.append(("token", self._current, "<"))
                self._buf = self._buf[1:]
                return True
            kind, agent, taglen = match
            if kind == "close" and agent == self._current:
                events.append(("agent_end", self._current))
                self._current = None
                self._buf = self._buf[taglen:]
                return True
            if kind == "close":
                self._buf = self._buf[taglen:]
                return True
            # open while inside another tag - auto-close current
            events.append(("agent_end", self._current))
            self._current = None
            if agent in self._opened:
                self._buf = self._buf[taglen:]
                return True
            self._opened.add(agent)
            self._current = agent
            self._seen_any_tag = True
            events.append(("agent_start", agent))
            self._buf = self._buf[taglen:]
            return True

        # outside a tag
        lt = self._buf.find("<")
        if lt == -1:
            if self._seen_any_tag:
                self._buf = ""
            return False
        if lt > 0:
            self._buf = self._buf[lt:]
            return True
        match = self._try_match()
        if match == "incomplete":
            return False
        if match is None:
            if not self._seen_any_tag:
                # Untagged prose at start - implicit Luffy.
                self._opened.add("luffy")
                self._current = "luffy"
                self._seen_any_tag = True
                events.append(("agent_start", "luffy"))
                return True
            self._buf = self._buf[1:]
            return True
        kind, agent, taglen = match
        if kind == "close":
            self._buf = self._buf[taglen:]
            return True
        if agent in self._opened:
            self._buf = self._buf[taglen:]
            return True
        self._opened.add(agent)
        self._current = agent
        self._seen_any_tag = True
        events.append(("agent_start", agent))
        self._buf = self._buf[taglen:]
        return True
