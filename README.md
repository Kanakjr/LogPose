# LogPose

A personal One Piece-themed habit tracker PWA. You play the Captain of your own crew. Real-world actions raise your **Bounty**, train your **Haki**, and the **Log Pose** only advances toward the next island when the day's voyages are cleared. A **Marine Verifier** (Gemini 2.5 Flash Vision) judges your photo evidence so cheating is impossible, and the **Straw Hat Crew** (Luffy, Zoro, Nami, Robin, Chopper) is a chat-able AI companion service.

Three-container app (backend + crew + ui) you run with `docker compose up`.

## Services

| Service | Port | What it does |
|---|---|---|
| `logpose-backend` | 8324 | Game state, voyages, Marine Verifier (Gemini Vision), Devil Fruit drops, APScheduler rollover. |
| `logpose-crew` | 8325 | Straw Hat Crew chat (SSE), persona prompts, skill packs, captain-state read-only access. |
| `logpose-ui` | 3005 | Next.js 15 PWA. Wanted Poster, Today's Log Pose, voyage camera capture, Treasure, Grand Line map, Journal, Crew Quarters. |

## Layout

```
.
  backend/                  FastAPI + SQLite (bounty.db)
    app/
      main.py               app entry, CORS, X-LOGPOSE-KEY middleware
      config.py             pydantic-settings, TZ, Gemini, rollover
      db.py                 sqlite3 + schema (captain, voyages, voyage_log, treasure, log_pose, events)
      seed.py               13 Straw Hat voyages targeting the Captain's health profile
      bounty.py             tier ladder + Grand Line islands
      captain.py            award_bounty, change_morale, add_treasure, emit_event
      loot.py               Devil Fruit drop table (variable-ratio loot)
      cron.py               APScheduler daily Log Pose rollover (default 04:00 local)
      integrations/marine_verifier.py    Gemini 2.5 Flash vision call
      routers/              captain, voyages, treasure, journal, grand_line, admin, health
    Dockerfile
    requirements.txt
    .env.example

  crew/                     FastAPI deepagent + Gemini + SQLite (crew.db)
    app/
      main.py               app entry, X-LOGPOSE-CREW-KEY + internal-key middleware
      llm.py                stream_crew + tagged-block parser (asmi pattern, generalized to N agents)
      model_policy.py       per-persona model + skill bindings
      prompts/
        crew.md             orchestrator + grammar (one of <luffy> <zoro> <nami> <robin> <chopper> + actions)
        crew/luffy.md       persona prompts (asmi cats.md style)
        crew/zoro.md
        crew/nami.md
        crew/robin.md
        crew/chopper.md
      skills/
        captain-state/SKILL.md        always-on game-state reader
        motivation/SKILL.md           Luffy
        training/SKILL.md             Zoro
        navigation/SKILL.md           Nami
        critique/SKILL.md             Robin
        medical/SKILL.md              Chopper
        obsidian-brain/SKILL.md       Robin / Chopper
        huberman-codex/SKILL.md       always-on protocol reference
        runtime.py                    tool implementations + context bundler
      routers/chat.py       /api/crew, /api/crew/chat (group SSE), /api/crew/{c}/chat (1:1),
                            /api/crew/{c}/history, /api/crew/event (webhook), /api/crew/nudges
    data/huberman/          curated Markdown of Huberman protocols
    Dockerfile
    requirements.txt
    .env.example

  ui/                       Next.js 15 + Tailwind v4 + Framer Motion + PWA
    src/
      app/                  layout, home, voyages, treasure, map, journal, crew, favicon, icon, apple-icon
      components/           PixelPortrait, CharacterHero, StatBar, HakiRings, VoyageRail,
                            DockNav, TopBar, DropReveal, CrewDock, ChatBubble, CrewChat
      components/magicui/   Magic UI primitives (dock, magic-card, number-ticker, ...)
      lib/api.ts            typed fetch + SSE async iterator
      lib/sprites.ts        sprite path map + crew accents
      middleware.ts         injects X-LOGPOSE-KEY / X-LOGPOSE-CREW-KEY server-side
    public/sprites/         chibi pixel-art PNGs (gemini-2.5-flash-image)
    public/manifest.webmanifest
    next.config.ts          /api/game/* -> backend, /api/crew/* -> crew, /media/* -> backend
    Dockerfile
    package.json
    .env.example

  scripts/                  sprite + favicon generation utilities
    generate_sprites.py     gemini-2.5-flash-image, chibi-style sprite set
    process_crew_avatars.py crop + resize per-character source avatars
    build_favicon.py        favicon.ico + icon.png + apple-icon.png from app-icon

  docs/                     research.md, objective.md (kept from the planning phase)
  docker-compose.yml        three-service stack: logpose-backend, logpose-crew, logpose-ui
  .env.example              shared keys consumed by all three services
```

## One Piece glossary -> game state

- **Bounty** = XP (raw integer). Display: `B 5,000,000`.
- **Bounty Tier** = level bracket: Rookie -> Supernova -> Warlord -> Yonko Commander -> Yonko -> Pirate King.
- **Berries** = soft currency (rewards, future cosmetics).
- **Crew Morale** = HP. Missed dailies drain it; verified voyages tick +2.
- **Haki** = four core stats:
  - `buso` (Armament) - strength training, cardio, cycling, cold exposure
  - `vitality` (Vitality) - sleep, hydration, sunlight, thyroid med adherence, nutrition
  - `kenbun` (Observation) - deep work, reading, language learning
  - `haoshoku` (Conqueror's) - NSDR, meditation, anti-doom-scrolling, social-connect
- **Voyages** = quests. `daily` voyages form the Log Pose; `one_shot` are Bounty Missions.
- **Verification modes**: `self`, `marine_photo` (Gemini Vision), `timer`, `stillness`.
- **Treasure Chest** = inventory. Rarities: `common`, `rare_cursed_blade`, `legendary_ancient_weapon`, `mythic_devil_fruit` (permanent stat bonus).
- **Grand Line islands** = bounty milestones (East Blue -> Reverse Mountain -> ... -> Wano -> Egghead -> Laugh Tale).
- **Marine Verifier** = Gemini 2.5 Flash vision-judging call.
- **Den Den Mushi** = the Crew chat (1-on-1 or group).

## The Straw Hat Crew (logpose-crew)

| Crewmate | Role | When they speak unprompted |
|---|---|---|
| **Luffy** | Motivator | After 2+ days of skipped dailies; on any tier-up. |
| **Zoro** | Trainer | When Buso Haki is the lowest stat for 3+ days; missed Zone 2 Cruise. |
| **Nami** | Navigator | Sunday weekly review; streak hits multiple of 7. |
| **Robin** | Strict critic | Recurring excuse patterns; monthly review. |
| **Chopper** | Doctor | Lab risks: skipped meds, late caffeine, missed sleep target. |

Architecture mirrors **`asmi`** (one Markdown prompt per crewmate, tagged-block streaming grammar `<luffy>...</luffy>`) plus **`homebot-deepagent`** (per-skill `SKILL.md` packs with bound tools, progressively disclosed).

## Deploy

1. **Copy `.env.example` to `.env`** and fill in the keys:

   ```bash
   cp .env.example .env
   # then edit .env:
   #   GEMINI_API_KEY=...          your Google Gemini API key (required)
   #   LOGPOSE_API_KEY=...         random hex string (browser <-> backend auth)
   #   LOGPOSE_CREW_KEY=...        random hex string (browser <-> crew auth)
   #   LOGPOSE_CREW_INTERNAL_KEY=  random hex string (backend <-> crew webhook)
   #   OBSIDIAN_VAULT_PATH=...     absolute path to your Obsidian vault (optional)
   ```

   Generate strong random hex keys with `openssl rand -hex 32`.

2. **Build & run**:

   ```bash
   docker compose up -d --build
   ```

   The three services come up on:

   - `http://localhost:3005` - the PWA (`logpose-ui`)
   - `http://localhost:8324` - the game backend
   - `http://localhost:8325` - the crew service

3. **Seed** (auto-runs on first start, but you can force-reseed for dev):

   ```bash
   curl -X POST -H "x-logpose-key: $LOGPOSE_API_KEY" \
        "http://localhost:8324/api/admin/seed?force_reset=true"
   ```

4. **Mobile access**. The UI is a PWA. Reverse-proxy `logpose-ui:3000` through any tunnel of your choice (Cloudflare Tunnel, Tailscale Funnel, ngrok, Caddy, ...), then open the public URL on your phone and `Add to Home Screen` from Safari/Chrome - it installs as a standalone app.

## Local dev (outside Docker)

```bash
# Backend
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
DB_PATH=./data/bounty.db MEDIA_DIR=./data/media \
  .venv/bin/uvicorn app.main:app --reload --port 8324

# Crew (in another terminal)
cd crew
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
GEMINI_API_KEY=... GAME_BACKEND_URL=http://localhost:8324 \
  DB_PATH=./data/crew.db OBSIDIAN_VAULT_PATH=/path/to/vault \
  HUBERMAN_CODEX_PATH=./data/huberman \
  .venv/bin/uvicorn app.main:app --reload --port 8325

# UI (in a third terminal)
cd ui
npm install
BACKEND_URL=http://localhost:8324 CREW_URL=http://localhost:8325 npm run dev
# open http://localhost:3005
```

## Key API endpoints

### Game backend (`:8324`)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/captain` | Wanted Poster: Bounty, Haki, Morale, Berries, tier, island. |
| GET | `/api/voyages/today` | Today's Daily Log Pose with streaks and `done_today` per voyage. |
| GET | `/api/voyages` | All active voyages. |
| GET | `/api/voyages/{id}` | Single voyage. |
| POST | `/api/voyages` | Create custom Voyage (crew can call this via `voyage_create` action). |
| PUT | `/api/voyages/{id}` | Edit. |
| DELETE | `/api/voyages/{id}` | Soft-deactivate. |
| POST | `/api/voyages/{id}/attempt` | Multipart photo for marine_photo voyages; otherwise mode=self/timer. Returns verdict + bounty/berries + drop. |
| GET | `/api/journal?since=` | Paginated voyage_log feed for the Journal page. |
| GET | `/api/treasure` | Chest grouped by rarity. |
| GET | `/api/map` | Grand Line islands + bounty target for next. |
| POST | `/api/admin/seed?force_reset=` | Seed/re-seed the Straw Hat Voyage Pack. |
| POST | `/api/admin/reset_captain` | Reset Captain back to Rookie. |
| POST | `/api/admin/run_rollover` | Trigger the daily rollover on demand (testing). |

### Crew service (`:8325`)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/crew` | Crewmate roster + online status (online iff `GEMINI_API_KEY` is set). |
| POST | `/api/crew/chat` | Den Den Mushi (group). SSE stream of tagged blocks for 1-3 crewmates. |
| POST | `/api/crew/{key}/chat` | One-on-one with one crewmate (`luffy` / `zoro` / `nami` / `robin` / `chopper`). |
| GET | `/api/crew/{key}/history?limit=` | Per-thread history. |
| POST | `/api/crew/event` | Webhook from game backend on tier_up / missed_daily / lab_risk / mythic_drop. Internal-only. |
| GET | `/api/crew/nudges` | Pending proactive messages; marks them delivered. |

## Customizing personas

Edit Markdown files in `crew/app/prompts/crew/*.md` and restart the `logpose-crew` container - no rebuild needed for prompt changes since the files are baked into the image at build time. (For instant-iteration during development, mount the prompts folder as a volume.)

The orchestrator prompt is `crew/app/prompts/crew.md` and defines the strict tagged-block grammar. The parser in `crew/app/llm.py` (`_CrewTagParser`) handles partial tags across SSE chunks, auto-closes unclosed tags at end-of-stream, and falls back to Luffy if the model emits untagged prose.

## Roadmap (not in MVP)

- Yonko Battles - multi-day boss-fight quests for major real-world projects.
- Sea King / Marine Admiral - Rage Bosses spawned by procrastinated high-value tasks.
- Oracle Den Den Mushi - auto-scraper for the Huberman codex, nutrition lookups.
- Apple Health / Screen Time / Gmail integrations (real auto-verification).
- Crew roles (Swordsman / Cook / Sniper / etc.) that buff specific Voyage categories.
- Party voyages - shared quests with friends if and when the app goes multi-user.
- Audio responses from the crew via voice synthesis.
- Cosmetic 3D printing and MS Flight Sim hobby packs (parked).
