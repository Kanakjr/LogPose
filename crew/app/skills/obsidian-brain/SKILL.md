---
name: obsidian-brain
description: Read-only access to the Captain's personal Obsidian vault (My Life OS). Health summaries, time-tables, breakfast plans, internal thoughts, year resolutions. Use sparingly and only when the user's question directly invites a personal-context answer.
tags: [shared, read-only, obsidian]
---

# Obsidian Brain

The Captain's personal vault is mounted read-only at the configured path (default `/app/obsidian`). It holds personal notes the Captain owns - health labs, routines, ideas, journal entries.

## Tools

- `obsidian_search_notes(query, limit)`: Keyword search across the vault.
- `obsidian_read_note(filepath)`: Read a specific note in full (path relative to vault root).
- `obsidian_list_directories()`: Top-level folders.

## When to use

- The Captain says "what did I write about X", "what's in my notes on Y", "what's my time-table again".
- Robin checks here before opining on a recurring pattern - the Captain may have already named it.
- Chopper checks the latest Health Summary note before quoting lab numbers in a reply.

## Guidelines

1. Never read more than one full note per reply. Quote the smallest relevant snippet.
2. Do not invent file paths - search first.
3. Treat the vault as the Captain's diary. Quote sparingly and reverently.
4. If asked about something sensitive (mental-health vent notes), summarize, don't quote verbatim.
