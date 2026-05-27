---
name: captain-state
description: Read-only access to the Captain's live state - bounty, Haki levels, current island, today's voyages, recent journal entries, treasure chest. Always available to every crewmate as their default situational awareness.
tags: [shared, read-only, game-state]
---

# Captain State

You have read-only HTTP access to the LogPose game backend over the Docker network. Use these to ground your reply in what the Captain is actually doing right now, not what you imagine them to be doing.

## Tools

- `get_captain()`: Full Captain sheet (bounty, bounty_tier_label, berries, morale, four Haki levels, current_island, next_island).
- `list_voyages_today()`: Today's Daily Log Pose - which voyages are scheduled, which are done today, current streak for each.
- `list_recent_log(days)`: Voyage attempts in the last `days` days (default 7), with verdict and bounty awarded.
- `get_treasure()`: Latest items in the Treasure Chest, grouped by rarity.
- `get_streaks()`: Per-voyage current and longest streaks.

## When to use

- Almost every meaningful reply. If the Captain says "I'm tired", check what they did the past 2 days before sympathizing.
- Before suggesting a Voyage, check if one like it already exists.
- Before celebrating a streak, confirm it's the actual current streak (not stale memory).
- Before Chopper mentions a missed Thyronorm, check today's log.

## Guidelines

1. Do not read the whole tool output back at the Captain. Use one number or one fact and move on.
2. Treat all data as the source of truth - never invent voyages, items, or stats not present in the response.
3. If a call fails, say so briefly ("Den Den Mushi is fuzzy today") and answer with the user's message alone.
