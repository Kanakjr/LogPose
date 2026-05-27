---
name: huberman-codex
description: Curated snippets from Andrew Huberman's protocols (morning sunlight, caffeine delay, NSDR, Zone 2, sleep). Stored as Markdown under data/huberman/. Read these when the Captain asks "what's the protocol for X" or when proposing a new Voyage that maps to a known Huberman protocol.
tags: [shared, read-only]
---

# Huberman Codex

A small hand-curated set of Markdown notes summarizing Huberman Lab protocols. Source: the YouTube playlist in `Apps/habit/docs/objective.md`. Updated occasionally by hand; not auto-scraped (Oracle is on the roadmap).

## Tools

- `codex_list()`: List the codex entries by filename.
- `codex_search(query)`: Keyword search across all entries.
- `codex_read(slug)`: Read one entry in full.

## Guidelines

1. Quote one fact and cite the protocol name. Don't paste an entire entry.
2. Use this when crafting a `<voyage_create>` so the verifier_prompt actually matches the protocol the Captain is following.
3. If the codex has no entry on the topic, say so - don't make up a Huberman protocol that doesn't exist.
