# LogPose UX Critique and Improvement Plan

**Audience:** Kanak (Captain Kanak), single-user personal habit tracker  
**Evaluated:** https://logpose.kanakjr.in/ — desktop ~1440x900 and mobile ~390x844  
**Date:** 2026-05-27  
**Method:** Live browser walkthrough (navigate, snapshot, screenshot, click-through flows) plus source review in `Apps/habit/ui/src/`

Screenshots captured during review (MCP browser; some saved to disk, others embedded in session):

| Page | Desktop | Mobile |
|------|---------|--------|
| Dashboard `/` | `/tmp/logpose-ux-critique/desktop/01-dashboard.png` | snapshot after Thyronorm completion (1/13, bounty 200k) |
| Voyages `/voyages` | snapshot | same viewport |
| Voyage detail `/voyages/3` (Thyronorm) | snapshot (idle + Victory states) | same |
| Crew `/crew` | snapshot | same |
| Treasure `/treasure` | snapshot | same |
| Map `/map` | snapshot | same |
| Journal `/journal` | snapshot (1 entry after test completion) | same |

---

## 1. TL;DR

If Kanak only had a weekend, do these five things — in this order:

1. **Morning quick-log strip on the dashboard** — Pin Thyronorm, Set Sail at Dawn, Sea Water Ration, and Sanji's Brew Timer at the top with one-tap "Mark complete" for self-report voyages. Right now every habit costs 3 taps minimum (dashboard → detail → submit). Thyronorm is the highest-stakes daily action and it is buried in a 13-item scroll.

2. **Real in-app timers for timer-mode voyages** — `Sanji's Brew Timer` (90 min), `Drum Island Trial` (3 min), and `Thousand Sunny Rest` (20 min) all say "run the timer in real life" (`voyages/[id]/page.tsx` lines 191-193) but there is no timer UI. For someone whose phone is the first thing he looks at in the morning, the caffeine-delay ritual needs a visible countdown, not an honor-system checkbox.

3. **"Today's focus" instead of 13 open voyages** — Kanak's own "good looks like" list has 8 items. The seed pack has 13 daily voyages (`backend/app/seed.py`). Showing all 13 with equal weight on mobile guarantees scroll fatigue and reinforces the "I already failed" feeling before breakfast. Collapse to 4-5 priority voyages plus a "See all" link.

4. **Fix the bounty/berries label bug and add micro-celebrations** — `CharacterHero.tsx` line 51 labels bounty as "berries". After completing Thyronorm, the Victory panel showed rewards but no confetti (`DropReveal` only fires on loot drops). Self-report wins need a smaller celebration loop or the RPG layer feels hollow on day one.

5. **Make crew nudges actionable** — Chopper already nags about Thyronorm in chat (good). But nudges are dismiss-only (`crew/page.tsx` lines 74-82) and chat cannot mark a voyage done. Tap a nudge → open that voyage. Tap "Add this" on a proposed voyage → navigate to it, not `alert("Added.")` (`CrewChat.tsx` lines 296-300).

---

## 2. Per-page critique

### `/` — Dashboard

**Verdict:** Strong visual identity and correct data model, but the daily workflow is too slow and too long for a phone-first morning check-in.

**What's working**

- `CharacterHero` personalization ("Captain Kanak", Rookie Pirate tier, East Blue) lands the One Piece fantasy without being cringe.
- Two-column layout at `lg` (`page.tsx` lines 122-132) — identity/progress left, voyages right — is the right desktop structure.
- Log Pose ring (`AnimatedCircularProgressBar` + copy at lines 55-96) is a clear daily north star.
- `VoyageRail` completion state (amber border, strikethrough, checkmark) reads instantly after marking Thyronorm done.
- Haki rings give at-a-glance stat feedback (Vitality ticked 1→2 after one completion).

**What's not**

- **13 voyages, flat, unordered.** Seed order in `seed.py` is roughly morning-first, but the UI does not surface that. On mobile, Kanak sees CharacterHero + Log Pose + Haki (three cards) before the first habit row — roughly two full screens before action.
- **No inline completion.** Tapping a voyage navigates to `/voyages/[id]`. Self-report habits (Thyronorm) could be one tap from the dashboard; photo habits could open camera directly.
- **Bounty mislabeled as berries** in `CharacterHero.tsx` lines 47-51. After completing Thyronorm, bounty correctly showed 200,000 but the suffix still read "berries".
- **Log Pose copy is passive.** "Finish 12 more to advance" does not tell Kanak *which* habit matters next. For someone fighting doom-scroll, specificity beats percentage.
- **Desktop SideNav may not be deployed.** Source has `SideNav` at `lg+` (`layout.tsx` line 44, `DockNav.tsx` line 33 `lg:hidden`), but live site at 1440px still showed bottom DockNav in browser testing. Verify deploy; if SideNav is live on Mac mini, ignore this — if not, desktop is literally a centered mobile column with wasted horizontal space.
- **Haki rings lack context.** Four rings at Lv 1-2 with no "how to level" hint. Kanak won't know completing Zone 2 Cruise levels Buso unless he already knows the mapping from `research.md`.

**Recommended changes**

- Add a `MorningStrip` component above the full voyage list: Thyronorm + next 2-3 rituals, with inline complete for `verification_mode === "self"`.
- Sort/group voyages by time window (Morning / Midday / Evening) using category + title heuristics from seed data.
- Fix CharacterHero label: bounty number + "bounty", move berries to the existing Berries pouch stat bar.
- Replace "Finish N more" with "Next up: Thyronorm Roll Call" (first incomplete, priority-weighted).
- On `lg`, let the voyage list use full 7-col width with tighter rows; consider a compact density toggle.

---

### `/voyages` — All voyages

**Verdict:** Useful as a catalog, redundant as a daily driver. Tabs help but do not reduce overwhelm.

**What's working**

- Tabbed categories with counts (`voyages/page.tsx` lines 61-86) — Rituals 10, Crew duties 3 — matches mental model from seed pack.
- Animated tab pill (`layoutId="voyage-tab-pill"`) is polished without being distracting.
- Same `VoyageRail` component as dashboard = consistent visual language.

**What's not**

- **Duplicate of dashboard.** Same 13 rows in the same order. No search, no sort, no "not done today" filter. Kanak has no reason to visit this page daily except habit.
- **Tabs too cramped on mobile.** Three tabs at 390px (`All 13 | Rituals 10 | Crew duties 3`) use `text-xs` and `flex-1` — tap targets are ~44px tall (acceptable) but labels truncate visually when four tabs exist (Bounties tab appears when count > 0).
- **No edit/archive.** Single-user app still needs a way to deactivate voyages that aren't working (e.g., Zone 2 before he has a bike routine).
- **Bounty tab hidden when empty** — fine for now, but the tab bar jumps when first bounty mission is added.

**Recommended changes**

- Default tab to "Rituals" on mobile, not "All".
- Add a "Due today" filter toggle (show only `!done_today`).
- Show verification mode icon + time hint in subtitle (camera = photo proof, clock = timer).
- Long-term: voyage management (pause, reorder, edit bounty) — lower priority than dashboard fixes.

---

### `/voyages/[id]` — Voyage detail (Thyronorm, id=3)

**Verdict:** Clean detail page, but timer mode is a stub and the post-success flow has wrong affordances.

**What's working**

- Hero card with description, bounty/berries chips, Haki affinity, verification badge (`page.tsx` lines 106-138).
- Self-report flow is fast: one `ShimmerButton` → Victory in ~1 second.
- Victory panel shows bounty/berries awarded clearly (lines 298-330).
- Photo upload target is large (h-56 dashed box, lines 161-168) — thumb-friendly for marine_photo voyages.
- `capture="environment"` on file input (line 175) opens rear camera on mobile.

**What's not**

- **Timer voyages are fake.** UI copy says "Run the timer in real life, then mark complete" — no countdown, no `cooldown_sec` usage, no background timer. This breaks the Huberman caffeine-delay protocol that the seed pack was built around (`seed.py` line 63: `cooldown_sec: 5400`).
- **"Try again" after success** (lines 349-355) makes no sense on a completed daily voyage. Should be "Done" or disappear.
- **No celebration without loot.** Thyronorm completion showed Victory text only — no confetti, no streak callout (streak existed in data: link name showed "1" on dashboard). `DropReveal` requires a drop object.
- **Back link is small** — `text-xs` uppercase (lines 97-103), top-left, easy to miss on mobile.
- **Photo retake flow is fine but adds steps** — acceptable for verification, but morning photo habits (Set Sail at Dawn) compete with Instagram for phone attention. Consider launching camera from dashboard row.

**Recommended changes**

- Build `VoyageTimer` component: read `cooldown_sec` from voyage, show countdown, disable submit until elapsed, persist timer state in `localStorage` for page refresh.
- Post-success: hide "Try again" for daily recurrence; show streak flame + "Log Pose +1" animation.
- Always run a lightweight confetti burst on Victory (reuse `DropReveal` confetti ref or `magicui/confetti` directly).
- Primary CTA after success: "Next voyage" (auto-advance to next incomplete) instead of generic "Back to today".

---

### `/crew` — Crew quarters

**Verdict:** Best personalized feature in the app — Chopper mentioning Thyronorm unprompted is exactly right — but chat is disconnected from doing the habits.

**What's working**

- Streaming multi-agent group chat works; Nami/Robin/Chopper gave relevant, non-generic advice when asked "what should I do today?"
- Nudges surface at top with crew-colored accent bar (`crew/page.tsx` lines 51-86).
- `CrewDock` horizontal scroll with pixel portraits (`CrewDock.tsx`) — good touch targets (`whileTap scale 0.94`).
- Chat input is iMessage-style, Enter-to-send, reasonable 40px min height.
- Crew reads Kanak's bio (Thyronorm mention matches `me.md` and `crew.md`).

**What's not**

- **Chat ≠ action.** Cannot mark Thyronorm done from Chopper's nudge. Kanak has to leave chat, find the voyage, complete it. For someone with low executive function bandwidth, this is a leak in the funnel.
- **Group mode floods the screen.** One user message triggered 4+ crew replies visible at once. Kanak's bio says "plain talk, not pep-speak" — four voices congratulating "Good to hear from you, Captain!" is noise.
- **Crew dock scroll is easy to miss.** In testing, only "All crew" tile was visible without horizontal scroll — individual crew portraits (Luffy, Zoro, etc.) were off-screen. New users won't discover 1:1 chat.
- **`SparklesText` on "Crew quarters"** (`crew/page.tsx` lines 38-42) fights Kanak's stated preference for plain UI.
- **`alert()` for voyage creation** (`CrewChat.tsx` lines 296-300) — breaks immersion, no navigation to new voyage.
- **Chat panel is 62vh on mobile** (`crew/page.tsx` line 97) — with dock nav, nudges, and dock, the input area sits right above bottom nav. Keyboard will cover half the thread.

**Recommended changes**

- Add action buttons on nudges: "Open Thyronorm" → `/voyages/3`.
- In group mode, collapse to one "navigator" reply by default (Nami or Robin), with "Ask the full crew" as opt-in.
- Replace `alert()` with toast + link to new voyage.
- Remove `SparklesText` from heading; keep sparkles for loot drops only.
- Add quick-reply chips: "Mark Thyronorm done", "What's my next habit?", "I'm stuck scrolling".

---

### `/treasure` — Treasure chest

**Verdict:** Pretty empty state, zero engagement loop on day one. Loot exists in the backend but Kanak cannot see it working yet.

**What's working**

- Rarity-tier layout (Mythic `NeonGradientCard`, others `MagicCard`) is visually distinct.
- Empty state copy is on-theme: "The chest sits empty. Verified voyages drop loot. Set sail." (`treasure/page.tsx` lines 77-84).
- Grid scales 1 → 2 → 3 → 4 cols across breakpoints (line 134).

**What's not**

- **Self-report Thyronorm gave no loot.** Treasure still empty after first completion. If drops are photo-only, say so — otherwise the RPG promise is broken on the easiest habit.
- **No "ghost loot" preview.** Empty chest could show silhouettes of devil fruits / chests with "Complete voyages to unlock" — gives Kanak something to chase.
- **Treasure is disconnected from dashboard.** No "recent drop" ticker on home page.
- **Page feels like a dead end** when empty — no CTA button, just text.

**Recommended changes**

- Guarantee a small drop on first-ever voyage completion (tutorial drop).
- Add CTA button in empty state: "Go to today's voyages".
- Show drop probability or "last drop" on voyage detail chips.
- Dashboard widget: "Latest loot" or "Next mythic roll in N voyages" if backend supports pity timer.

---

### `/map` — Grand Line

**Verdict:** Beautiful timeline, demotivating math. Long-term progression needs nearer milestones.

**What's working**

- Island timeline with pixel art, lock/unlock/current states (`map/page.tsx` lines 88-166).
- Next-island progress card with `NumberTicker` (lines 53-85) — clear goal structure.
- Current island highlighted with `BorderBeam` and "Here" badge.

**What's not**

- **Next island at 5,000,000 bounty feels unreachable.** Kanak just earned 200,000. "4,999,995 more bounty" reads as "this app doesn't apply to me."
- **No daily connection.** Completing 1/13 voyages did not visibly move the map ring (still 0% to Reverse Mountain — segment math uses bounty between island thresholds).
- **Island list is long with no collapse** — future islands (Skypiea, etc.) scroll forever with `opacity-60` locked cards. Pretty but low signal.
- **"Charted to East Blue."** — trailing space in snapshot suggests minor copy/render glitch.

**Recommended changes**

- Add micro-milestones within East Blue (e.g., 500k, 1M, 2M) before Reverse Mountain — or show weekly bounty target instead of island threshold on dashboard.
- Animate map ring from dashboard when voyage completes (shared progress event).
- Collapse locked islands beyond next 2 into "Further Grand Line".
- Show "At current pace: ~N days to Reverse Mountain" based on 7-day average.

---

### `/journal` — History

**Verdict:** Solid audit log design, underused because Kanak has almost no history. Will pay off later.

**What's working**

- Infinite scroll with intersection observer (`journal/page.tsx` lines 49-61).
- Day grouping with sticky headers (line 93).
- Verdict badges (amber success / rose reject), bounty/berries inline, marine reasoning quote.
- Evidence thumbnail + lightbox (lines 169-228) — good for photo verification review.
- 2-column grid at `lg` (line 96).

**What's not**

- **Empty state is generic** — "Nothing logged yet. Today is a good day to start." No link to first voyage.
- **Sticky header `top-12`** may collide with TopBar on mobile — verify safe area.
- **Verdict labels are dev-speak** — "self reported" should be "Self-report" or "Captain's word".
- **No trends.** Kanak's labs (HbA1c, triglycerides) need weekly/monthly consistency views — journal is entry-by-entry only.
- **Photo gallery mode missing.** Cannot browse all evidence photos across entries.

**Recommended changes**

- Empty state CTA: "Start with Thyronorm" → `/voyages/3`.
- Add weekly summary card at top: "5/7 days Thyronorm, 2/7 Set Sail at Dawn".
- Humanize verdict strings in display layer.
- Phase 2: `/journal/photos` grid view for marine_photo entries.

---

## 3. Cross-cutting issues

### Navigation

- **Mobile DockNav is icon-only** (`DockNav.tsx`). Comment says "label only when active" but implementation shows icons only with `aria-label`. Six icons without text labels — Kanak will forget which is which for infrequent pages (Treasure vs Map).
- **Six destinations is one too many** for daily use. Crew + Today cover 90% of sessions. Consider elevating "Today" as default PWA launch and demoting Journal/Treasure to secondary menu on mobile.
- **No breadcrumbs on voyage detail** except small Back button. Deep links from crew should stack navigation history properly.

### Habit-formation efficacy (Kanak-specific)

- **Cost of completion is too high for easy habits, too fake for hard ones.** Self-report = 3 taps. Timer = honor system. Photo = camera + upload + AI wait. Calibrate: easy habits fast, hard habits verified.
- **13 daily quests vs 8 "good looks like" items** (`me.md` lines 68-76). Merge or defer: Ohara Scholar and Hunter's Codex are stretch goals, not daily musts for someone who isn't exercising yet. Consider `active: false` on low-priority voyages until Buso habits stick.
- **No loss aversion.** Missing Thyronorm has no consequence visible in UI. Morale is 100/100 despite 0/13 start. Habitica-style damage or streak-break warnings would help — even a simple "Log Pose drifts" message at midnight.
- **Doom-scroll voyage (Resist the Sirens) is end-of-day photo** — correct timing, but no Screen Time API integration. Manual screenshot is easy to forget or game. Accept for v1, but flag as high-friction.

### Information density and hierarchy

- **Typography scale is consistent** (display xs/sm/base, mono for numbers) but **reward numbers dominate** voyage rows (+300,000 bounty). Kanak knows the gamification — the habit title should be primary, rewards secondary.
- **Three header cards before habits on mobile** (Hero, Log Pose, Haki) — identity before action. Flip priority: Log Pose + first habit above fold, Hero collapses to compact bar.

### Mobile-first feel

- **Dock + pb-28** (`layout.tsx` line 41) clears nav adequately.
- **Dock magnification on hover** (`DockNav.tsx`) is desktop-only behavior; fine.
- **`maximumScale: 1, userScalable: false`** (`layout.tsx` lines 23-24) — accessibility fail. Kanak may need zoom; remove this.
- **VoyageRail tap targets** (~48px icon + py-2.5) are acceptable; inline complete button would need min 44px.

### Desktop polish

- **max-w-2xl on main** (`layout.tsx` line 45) below `lg` — correct for mobile.
- **At lg+, main becomes flex-1** but voyages/map/journal pages re-impose `max-w-3xl` internally — content stays narrow column in a wide shell. Use the space for side-by-side detail (voyage list + detail pane) on desktop.

### Tone and theming

- **One Piece flavor works when tied to mechanics** — Log Pose, bounty, Grand Line, Den Den Mushi all map to real concepts. Less effective when decorative (SparklesText, "Hoisting the sails..." loading copy).
- **Crew voices mostly respect Kanak's plain-talk preference** in tested chat — keep tightening prompts to ban pep-speak and stage directions (already in `me.md` lines 17-18).
- **Pixel sprites are cohesive** — voyage icons all use sun sprite for rituals (minor: Thyronorm and Set Sail at Dawn share the same sunrise icon — differentiate Thyronorm with a pill icon).

### Visual craft

- **Glassmorphism surfaces** (`.surface` utility) — consistent, readable.
- **BorderBeam on CharacterHero, map current island, streak voyages** — tasteful alone, but cumulative motion may feel busy. Reserve BorderBeam for "special" states only.
- **Contrast is generally good** (zinc-100 on zinc-950). Amber on amber-400 buttons (black text) passes.
- **Focus rings** — chat textarea has focus border (`CrewChat.tsx` line 199); many buttons rely on hover only. Add `focus-visible:ring-2 focus-visible:ring-amber-300` to interactive elements.

### Engagement loops

- **Streak exists in data** (Thyronorm showed flame "1" on dashboard link) but **streak is tiny** on `VoyageRail` (10px chip). Streaks should be prominent for Thyronorm specifically.
- **Bounty tier-up exists** in result panel (`tier_up` block, page.tsx lines 333-347) but Kanak is Rookie Pirate at 200k — tier progression invisible until it happens.
- **Treasure empty = no variable reward.** Research doc emphasizes RPE / mythic drops — not felt yet.

### Empty / first-run / failure states

- **First run:** 0/13, empty treasure, empty journal, 0% map — four empty states at once. Overwhelming + demotivating.
- **Onboarding:** No first-run flow. Crew chat has history from prior testing; new deploy would confuse.
- **Failure:** Marine photo rejection shows "Rejected" panel — good. No guidance on retake (lighting, framing) beyond AI reasoning text.

---

## 4. New features worth considering

Ranked by impact-to-effort for Kanak specifically. Rejected ideas noted.

| Rank | Feature | Impact | Effort | Rationale |
|------|---------|--------|--------|-----------|
| 1 | Morning briefing screen (or dashboard mode) | High | S | Phone-first wake-up: Thyronorm → sun → water → caffeine timer. Directly attacks his stated morning failure mode. |
| 2 | In-app voyage timers | High | S | Seed pack assumes Huberman protocols; UI doesn't deliver. |
| 3 | Dashboard quick-complete (self-report) | High | S | Cuts 3 taps to 1 for Thyronorm. Highest-frequency action. |
| 4 | "Today's focus" (4-5 voyages) | High | S | Reduces 13-item paralysis. Aligns with `me.md` "good looks like". |
| 5 | Push notification / PWA install prompt | High | M | Kanak won't open the app if Instagram is already open. Thyronorm 7am, walk 8pm. |
| 6 | Micro-celebrations on every win | Med | S | Confetti + haptic + sound on Victory even without loot drop. |
| 7 | Weekly review screen | Med | M | "4/7 Thyronorm, 1/7 Zone 2, avg screen time unknown" — connects to lab goals. |
| 8 | Crew nudge → voyage deep link | Med | S | Closes chat-to-action gap. |
| 9 | Photo evidence gallery | Med | S | Journal already has images — aggregate view for "did I actually cook this week?" |
| 10 | Swipe-to-complete on VoyageRail | Med | M | iOS-native feel for self-report rows. |
| 11 | Screen Time screenshot reminder (Resist the Sirens) | Med | M | 9pm notification: "Screenshot your screen time before bed." |
| 12 | Near-term map milestones | Med | S | Fix demotivating 5M gap. |
| 13 | Voyage pause/archive UI | Med | S | Single-user still needs to trim pack without SQL. |
| 14 | Apple Health / Google Fit import | Low | L | Zone 2 verification would improve — but integration cost high for one user. Defer. |
| 15 | Voice input for crew chat | Low | M | Kanak types fine; voice adds complexity, not aligned with "quick check-in". **Reject.** |
| 16 | Dark/light toggle | Low | S | Kanak uses dark everything. **Reject.** |
| 17 | Import-from-email victories | Low | L | In research doc, not in current seed. **Defer** until core loop works. |
| 18 | Widget (iOS home screen) | Med | L | High impact but L effort; do after PWA notifications prove useful. |

---

## 5. Phased plan

### Phase 1 — This weekend (quick wins)

| # | Title | Rationale | Effort | Acceptance criteria |
|---|-------|-----------|--------|---------------------|
| 1.1 | Fix bounty/berries label in CharacterHero | Confusing economy undermines RPG trust | S | Bounty line reads "200,000 bounty"; berries only on Berries pouch bar |
| 1.2 | Morning priority strip on dashboard | Thyronorm buried in 13-item list | S | Top 4 morning rituals visible above fold; Thyronorm first |
| 1.3 | Inline quick-complete for self-report | 3 taps → 1 for daily pill | S | Tap checkmark on VoyageRail for `verification_mode: self` without navigation; dashboard refreshes count |
| 1.4 | Remove "Try again" after successful daily completion | Wrong affordance post-win | S | Victory panel for daily voyages shows only "Next" + "Back to today" |
| 1.5 | Victory confetti (no loot required) | RPG feedback loop dead on self-report | S | Any Victory verdict triggers brief confetti animation |
| 1.6 | Nudge → voyage deep link | Crew says Thyronorm, can't open it | S | Each nudge card has "Open voyage" button when voyage title matches |
| 1.7 | Remove userScalable:false | Accessibility | S | Pinch-zoom works on iOS Safari |
| 1.8 | Empty state CTAs | Dead-end pages | S | Treasure, Journal, Map empty states link to `/` or Thyronorm |

### Phase 2 — Next two weeks

| # | Title | Rationale | Effort | Acceptance criteria |
|---|-------|-----------|--------|---------------------|
| 2.1 | VoyageTimer component | Timer mode is honor-system today | M | Sanji's Brew shows 90:00 countdown; submit disabled until zero; survives page refresh |
| 2.2 | Today's focus mode | 13 voyages = paralysis | S | Dashboard toggle: Focus (5) / All (13); Focus set matches `me.md` priorities |
| 2.3 | DockNav labels | Icon-only nav hard to learn | S | Active tab shows text label below icon |
| 2.4 | Desktop voyage master-detail | Wide layout wasted | M | At `xl`, `/voyages` shows list left + detail right without full navigation |
| 2.5 | Weekly review card | Labs need consistency trends | M | New section on dashboard or `/journal`: 7-day completion rates per voyage |
| 2.6 | Guaranteed first-drop tutorial | Empty treasure demotivates | S | First completed voyage always drops a common chest item |
| 2.7 | Crew group mode throttle | 4 replies at once = noise | S | Default group reply from one crew member; "Ask all" expands |
| 2.8 | PWA install + Thyronorm notification | Phone is the enemy and the tool | M | Web push at configurable morning time; install prompt after 3 completions |
| 2.9 | Map micro-milestones | 5M feels hopeless | S | East Blue shows 3 sub-markers before Reverse Mountain |
| 2.10 | Deploy SideNav verification | Desktop nav may not be live | S | At 1440px, SideNav visible, DockNav hidden |

### Phase 3 — Later (bigger swings)

| # | Title | Rationale | Effort | Acceptance criteria |
|---|-------|-----------|--------|---------------------|
| 3.1 | Morning briefing route (`/morning`) | Dedicated wake-up flow | M | Full-screen 4-step flow: Thyronorm → photo sun → water → start caffeine timer; lands on dashboard when done |
| 3.2 | Swipe gestures on VoyageRail | Mobile-native completion | M | Swipe right on self-report row = complete; undo toast |
| 3.3 | Photo evidence gallery | Visual proof of cooking/sun/walks | M | `/journal/photos` grid, filterable by voyage type |
| 3.4 | Log Pose decay / streak loss | No consequence for missing days | L | Miss all voyages by midnight → Log Pose resets streak, morale drops, crew sends one nudge |
| 3.5 | Screen Time API for Resist the Sirens | Screenshot friction + gaming | L | iOS Screen Time read (if entitlement available) or scheduled reminder + OCR assist |
| 3.6 | Voyage editor UI | Tune pack without backend access | M | Pause, reorder, edit recurrence from `/voyages` admin mode |
| 3.7 | Separate voyage icons | Thyronorm shares sunrise sprite | S | Custom pill icon for Thyronorm in `sprites.ts` / `generate_sprites.py` |
| 3.8 | iOS home screen widget | Glance at 0/13 without opening Instagram | L | Widget shows Log Pose count + next habit |

---

## Appendix: Source files referenced

| Area | Primary files |
|------|---------------|
| Dashboard | `Apps/habit/ui/src/app/page.tsx` |
| Layout / nav | `Apps/habit/ui/src/app/layout.tsx`, `SideNav.tsx`, `DockNav.tsx` |
| Voyages list | `Apps/habit/ui/src/app/voyages/page.tsx`, `VoyageRail.tsx` |
| Voyage detail | `Apps/habit/ui/src/app/voyages/[id]/page.tsx`, `DropReveal.tsx` |
| Crew | `Apps/habit/ui/src/app/crew/page.tsx`, `CrewChat.tsx`, `CrewDock.tsx` |
| Treasure | `Apps/habit/ui/src/app/treasure/page.tsx` |
| Map | `Apps/habit/ui/src/app/map/page.tsx` |
| Journal | `Apps/habit/ui/src/app/journal/page.tsx` |
| Hero / stats | `CharacterHero.tsx`, `HakiRings.tsx`, `StatBar.tsx` |
| Seed data | `Apps/habit/backend/app/seed.py` |
| Captain bio | `Documents/Obsidian/.../me.md` (read only) |
| Product intent | `Apps/habit/docs/objective.md`, `research.md` |
