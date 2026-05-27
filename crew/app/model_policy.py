"""Per-persona model routing + skill bindings.

For MVP every crewmate uses Gemini 2.5 Flash. The hook is here so future
versions can route Robin to a bigger model or Chopper to a local Ollama for
medical privacy without touching the orchestrator.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.config import settings


@dataclass(frozen=True)
class PersonaPolicy:
    key: str
    name: str
    role: str
    voice: str
    model: str
    # Skills enabled when this persona speaks. Names match folder names under
    # app/skills/. The shared skills (captain-state, huberman-codex) are always
    # available; these are the persona-specific ones.
    skills: tuple[str, ...]


CREW: dict[str, PersonaPolicy] = {
    "luffy": PersonaPolicy(
        key="luffy",
        name="Luffy",
        role="Captain's Motivator",
        voice="loud, simple, hungry, future Pirate King energy",
        model=settings.gemini_model,
        skills=("motivation",),
    ),
    "zoro": PersonaPolicy(
        key="zoro",
        name="Zoro",
        role="Trainer & First Mate",
        voice="gruff, blunt, hates excuses, three swords",
        model=settings.gemini_model,
        skills=("training",),
    ),
    "nami": PersonaPolicy(
        key="nami",
        name="Nami",
        role="Navigator & Hype Squad",
        voice="playful, slightly greedy, cheers loud, knows the route",
        model=settings.gemini_model,
        skills=("navigation",),
    ),
    "robin": PersonaPolicy(
        key="robin",
        name="Robin",
        role="Strategist & Strict Critic",
        voice="calm, precise, devastating in the kindest way",
        model=settings.gemini_model,
        skills=("critique", "obsidian-brain"),
    ),
    "chopper": PersonaPolicy(
        key="chopper",
        name="Chopper",
        role="Ship's Doctor",
        voice="earnest, anxious, technical, cares too much",
        model=settings.gemini_model,
        skills=("medical",),
    ),
}


CREW_KEYS = tuple(CREW.keys())  # canonical order for orchestrator
