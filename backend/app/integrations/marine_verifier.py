"""Marine Verifier - Gemini 2.5 Flash vision call that judges photo evidence.

Given an image bytes blob plus the voyage's title, description, and a
verifier_prompt hint, returns a structured verdict:

    {"verdict": "verified" | "rejected", "reasoning": "...", "confidence": 0.0-1.0}

If the Gemini call fails (no API key, network blip, safety block), we
gracefully return ``rejected`` so the Captain has to re-shoot rather than
getting a free pass.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass

from google import genai
from google.genai import types

from app.config import settings

log = logging.getLogger("logpose.marine")

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is not None:
        return _client
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


SYSTEM_PROMPT = """You are the Marine Verifier - an incorruptible AI judge that decides whether a Captain's photo evidence proves they completed their Voyage.

You receive:
- The Voyage's TITLE and DESCRIPTION (what the Captain claims they did).
- Optional EXTRA CRITERIA the Voyage's author wrote to guide you.
- One image the Captain just took.

Your job is to evaluate the image strictly but fairly:
- Give the benefit of the doubt on small details when the image clearly matches the spirit of the Voyage.
- REJECT obvious fakes: a screenshot of someone else's photo, an empty cup when food was requested, a meme, a black frame, a finger over the lens, the same photo reused, indoor when outdoor is required, etc.
- If you genuinely cannot tell from the image, lean toward REJECT and explain what you would need to see.
- Be concise. 1-2 sentences of reasoning is plenty.

Respond ONLY with valid JSON of the exact shape:
{"verdict": "verified" OR "rejected", "reasoning": "...", "confidence": 0.0 to 1.0}
No prose, no markdown, no code fences. Just the JSON object."""


@dataclass(frozen=True)
class VerifierResult:
    verdict: str  # "verified" | "rejected"
    reasoning: str
    confidence: float


def _user_prompt(title: str, description: str, hint: str | None) -> str:
    parts = [f"VOYAGE: {title}", f"DESCRIPTION: {description or '(none)'}"]
    if hint:
        parts.append(f"EXTRA CRITERIA: {hint}")
    parts.append("Judge the attached image now.")
    return "\n".join(parts)


def _parse(text: str) -> VerifierResult:
    """Pull the JSON object out of the model reply, tolerating fences."""
    t = text.strip()
    # Strip ```json ... ``` fences if present.
    fence = re.match(r"^```(?:json)?\s*(.+?)\s*```$", t, re.DOTALL)
    if fence:
        t = fence.group(1).strip()
    try:
        data = json.loads(t)
    except json.JSONDecodeError:
        # Last-ditch: find the first {...} block
        m = re.search(r"\{.*\}", t, re.DOTALL)
        if not m:
            return VerifierResult(
                verdict="rejected",
                reasoning="Could not parse verifier response. Try a clearer photo.",
                confidence=0.0,
            )
        try:
            data = json.loads(m.group(0))
        except json.JSONDecodeError:
            return VerifierResult(
                verdict="rejected",
                reasoning="Could not parse verifier response. Try a clearer photo.",
                confidence=0.0,
            )
    verdict_raw = str(data.get("verdict", "")).strip().lower()
    verdict = "verified" if verdict_raw == "verified" else "rejected"
    reasoning = str(data.get("reasoning", "")).strip() or "No reasoning provided."
    try:
        confidence = float(data.get("confidence", 0.5))
    except (TypeError, ValueError):
        confidence = 0.5
    confidence = max(0.0, min(1.0, confidence))
    return VerifierResult(verdict=verdict, reasoning=reasoning, confidence=confidence)


async def verify_photo(
    *,
    image_bytes: bytes,
    mime_type: str,
    title: str,
    description: str,
    verifier_prompt: str | None,
) -> VerifierResult:
    """Send image + voyage context to Gemini, return a structured verdict."""
    if not settings.gemini_api_key:
        log.warning("Marine Verifier called but GEMINI_API_KEY is empty - auto-rejecting.")
        return VerifierResult(
            verdict="rejected",
            reasoning="Marine Verifier offline. Set GEMINI_API_KEY to enable photo verification.",
            confidence=0.0,
        )

    user_text = _user_prompt(title, description, verifier_prompt)

    def _run() -> str:
        client = _get_client()
        resp = client.models.generate_content(
            model=settings.gemini_model,
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_text(text=user_text),
                        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                    ],
                ),
            ],
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.2,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
                max_output_tokens=300,
            ),
        )
        return (resp.text or "").strip()

    try:
        text = await asyncio.to_thread(_run)
    except Exception as exc:
        log.warning("Marine Verifier call failed: %s", exc)
        return VerifierResult(
            verdict="rejected",
            reasoning=f"Marine Verifier hit a squall: {exc}. Try again.",
            confidence=0.0,
        )

    if not text:
        return VerifierResult(
            verdict="rejected",
            reasoning="Marine Verifier returned nothing.",
            confidence=0.0,
        )
    return _parse(text)
