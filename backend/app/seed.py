"""Seed the Straw Hat Voyage Pack.

Idempotent: re-running won't duplicate voyages. We key off (title) since the
seed pack is human-curated and the titles are unique.

Quests are themed for the Captain's personal health profile:
- Hypothyroid (Thyronorm 75 mcg) -> Thyronorm Roll Call
- High triglycerides / low HDL -> Zone 2 Cruise, Island Exploration
- Prediabetic HbA1c / high uric acid -> Sanji's Meal
- Low Vit-D, doom-scrolling -> Set Sail at Dawn, Resist the Sirens
- Anti-isolation -> Send a Den Den Mushi
- Hobby reactivation -> Hunter's Codex (Kindle), Ohara Scholar (Japanese)
"""

from __future__ import annotations

from app.db import connect, now_ts


STRAW_HAT_PACK: list[dict] = [
    # --- Vitality Haki (sleep, hydration, sun, thyroid, nutrition) ---
    {
        "title": "Set Sail at Dawn",
        "description": "Within 60 minutes of waking, get outside and breathe. Photo of the morning sky earns a bonus.",
        "haki_affinity": "vitality",
        "base_bounty": 300_000,
        "base_berries": 50,
        "verification_mode": "self",
        "recurrence": "daily",
        "category": "straw_hat_ritual",
        "verifier_prompt": "Verify the photo shows an outdoor view of the morning sky (sun, clouds, daylight - not a ceiling or screen). Reject if it's clearly indoors.",
        "icon": "sun",
        "theme_keyword": "sunlight",
        "time_window": "morning",
        "evidence_bonus_pct": 25,
    },
    {
        "title": "Sea Water Ration",
        "description": "500 ml of water plus a pinch of salt or an electrolyte sachet on waking.",
        "haki_affinity": "vitality",
        "base_bounty": 150_000,
        "base_berries": 25,
        "verification_mode": "self",
        "recurrence": "daily",
        "category": "straw_hat_ritual",
        "verifier_prompt": "Verify the photo shows a glass/bottle of water (clear liquid) and ideally an electrolyte packet, salt, or LMNT-style sachet. Accept just water if no sachet is visible.",
        "icon": "water",
        "theme_keyword": "hydration",
        "time_window": "morning",
        "evidence_bonus_pct": 20,
    },
    {
        "title": "Thyronorm Roll Call",
        "description": "Take your daily 75 mcg Thyronorm tablet on an empty stomach.",
        "haki_affinity": "vitality",
        "base_bounty": 200_000,
        "base_berries": 30,
        "verification_mode": "self",
        "recurrence": "daily",
        "category": "straw_hat_ritual",
        "verifier_prompt": None,
        "icon": "pill",
        "theme_keyword": "medication",
        "time_window": "morning",
        "evidence_bonus_pct": 15,
    },
    {
        # Was: verification_mode='timer' + cooldown_sec=5400. Removed the
        # timer requirement so it's just a tap-when-done daily.
        "title": "Sanji's Brew Timer",
        "description": "Wait 90 minutes after waking before your first caffeine. Tap when you've earned that first cup.",
        "haki_affinity": "vitality",
        "base_bounty": 250_000,
        "base_berries": 40,
        "verification_mode": "self",
        "recurrence": "daily",
        "cooldown_sec": 0,
        "category": "straw_hat_ritual",
        "verifier_prompt": "Verify the photo shows a fresh cup of coffee, tea, or another caffeinated drink - proving the Captain held the line until brew time.",
        "icon": "brew",
        "theme_keyword": "caffeine",
        "time_window": "morning",
        "evidence_bonus_pct": 20,
    },
    {
        "title": "Sanji's Meal",
        "description": "One real meal: protein-first, vegetables, no added sugar. Snap the plate for bonus bounty.",
        "haki_affinity": "vitality",
        "base_bounty": 350_000,
        "base_berries": 60,
        "verification_mode": "self",
        "recurrence": "daily",
        "category": "straw_hat_ritual",
        "verifier_prompt": "Verify the plate shows a real cooked meal with visible protein (chicken/eggs/fish/paneer/legumes) AND visible vegetables. Reject if the meal is dominated by sugar, sweets, sugary drinks, fried snacks, or refined carbs alone.",
        "icon": "meal",
        "theme_keyword": "nutrition",
        "time_window": "midday",
        "evidence_bonus_pct": 30,
    },
    # --- Buso Haki (movement, training, cold exposure) ---
    {
        "title": "Zone 2 Cruise",
        "description": "30+ minutes of steady-state cardio. Cycle, treadmill, or brisk walk. Heart rate stays conversational.",
        "haki_affinity": "buso",
        "base_bounty": 500_000,
        "base_berries": 80,
        "verification_mode": "self",
        "recurrence": "daily",
        "category": "straw_hat_ritual",
        "verifier_prompt": "Verify the photo shows a cardio session - cycle computer, treadmill dashboard, fitness tracker reading, or an outdoor cycling/walking GPS view - with evidence of at least 25 minutes of activity.",
        "icon": "bike",
        "theme_keyword": "cardio",
        "time_window": "anytime",
        "evidence_bonus_pct": 25,
    },
    {
        # Was: verification_mode='timer' + cooldown_sec=180.
        "title": "Drum Island Trial",
        "description": "3 minutes of cold exposure. Cold shower or plunge - tough it out, then tap.",
        "haki_affinity": "buso",
        "base_bounty": 300_000,
        "base_berries": 50,
        "verification_mode": "self",
        "recurrence": "daily",
        "cooldown_sec": 0,
        "category": "straw_hat_ritual",
        "verifier_prompt": None,
        "icon": "cold",
        "theme_keyword": "cold-exposure",
        "time_window": "morning",
        "evidence_bonus_pct": 15,
    },
    {
        "title": "Island Exploration",
        "description": "Walk for at least 15 minutes after dinner. Outside, not in the kitchen.",
        "haki_affinity": "buso",
        "base_bounty": 200_000,
        "base_berries": 35,
        "verification_mode": "self",
        "recurrence": "daily",
        "category": "straw_hat_ritual",
        "verifier_prompt": "Verify the photo shows an outdoor scene at night/evening - street lights, road, sky, trees, or buildings outside - proving the Captain went for a walk after dinner. Reject if clearly indoors.",
        "icon": "boots",
        "theme_keyword": "walk",
        "time_window": "evening",
        "evidence_bonus_pct": 25,
    },
    # --- Haoshoku Haki (mindfulness, social, anti-doom-scroll) ---
    {
        # Was: verification_mode='timer' + cooldown_sec=1200.
        "title": "Thousand Sunny Rest",
        "description": "20-minute NSDR, yoga nidra, or nap with the phone face-down.",
        "haki_affinity": "haoshoku",
        "base_bounty": 250_000,
        "base_berries": 40,
        "verification_mode": "self",
        "recurrence": "daily",
        "cooldown_sec": 0,
        "category": "straw_hat_ritual",
        "verifier_prompt": None,
        "icon": "moon",
        "theme_keyword": "rest",
        "time_window": "midday",
        "evidence_bonus_pct": 15,
    },
    {
        "title": "Resist the Sirens",
        "description": "Less than 2 hours of doom-scrolling today. Screenshot your screen-time report for the bonus.",
        "haki_affinity": "haoshoku",
        "base_bounty": 400_000,
        "base_berries": 70,
        "verification_mode": "self",
        "recurrence": "daily",
        "category": "straw_hat_ritual",
        "verifier_prompt": "Verify the photo is an iOS or Android screen-time / digital-wellbeing screenshot. Look at the total daily usage figure. ACCEPT only if total daily usage looks like less than 2 hours OR if Instagram/TikTok/Reels/YouTube Shorts category specifically shows under 2 hours. Reject if numbers are clearly higher or if it's not a screen-time screenshot at all.",
        "icon": "phone-down",
        "theme_keyword": "screen-time",
        "time_window": "night",
        "evidence_bonus_pct": 35,
    },
    {
        "title": "Send a Den Den Mushi",
        "description": "Reach out to one friend or family member. Voice note, call, or a real message - not a forward.",
        "haki_affinity": "haoshoku",
        "base_bounty": 300_000,
        "base_berries": 50,
        "verification_mode": "self",
        "recurrence": "daily",
        "category": "crew_duty",
        "verifier_prompt": "Verify the photo is a screenshot of a messaging app (WhatsApp, Telegram, iMessage, etc.) showing the Captain sent a personal message to one person. The message should be written specifically (not a generic 'Good morning' broadcast).",
        "icon": "den-den-mushi",
        "theme_keyword": "social",
        "time_window": "anytime",
        "evidence_bonus_pct": 25,
    },
    # --- Kenbun Haki (deep work, learning, hobbies) ---
    {
        "title": "Hunter's Codex",
        "description": "Read 10+ Kindle pages of non-fiction.",
        "haki_affinity": "kenbun",
        "base_bounty": 250_000,
        "base_berries": 40,
        "verification_mode": "self",
        "recurrence": "daily",
        "category": "crew_duty",
        "verifier_prompt": "Verify the photo is a Kindle page-progress screen, a Kindle reader screen showing book text, or an open physical book - proving the Captain actually read today.",
        "icon": "book",
        "theme_keyword": "reading",
        "time_window": "night",
        "evidence_bonus_pct": 25,
    },
    {
        "title": "Ohara Scholar",
        "description": "Finish today's Duolingo Japanese lesson (extend a learning streak).",
        "haki_affinity": "kenbun",
        "base_bounty": 200_000,
        "base_berries": 35,
        "verification_mode": "self",
        "recurrence": "daily",
        "category": "crew_duty",
        "verifier_prompt": "Verify the photo is a Duolingo screenshot - flame/streak icon, lesson-complete screen, or daily-goal-met screen. Accept other reputable language-learning apps (LingoDeer, Anki, Bunpo) too.",
        "icon": "scroll",
        "theme_keyword": "learning",
        "time_window": "anytime",
        "evidence_bonus_pct": 20,
    },
]


def seed_voyages(force_reset: bool = False) -> int:
    """Insert the Straw Hat Pack. Returns number of new voyages inserted.

    If force_reset is True, wipes all voyages first. Otherwise existing
    voyages keep their user state (streaks, attempt history) but their
    icon, time_window, verification_mode, evidence_bonus_pct, description
    and verifier_prompt are re-synced so a fresh boot picks up any tuning
    done in code.
    """
    inserted = 0
    ts = now_ts()
    with connect() as conn:
        if force_reset:
            conn.execute("DELETE FROM voyages")
            conn.execute("DELETE FROM log_pose")
        existing = {
            row["title"]: row["id"]
            for row in conn.execute("SELECT id, title FROM voyages").fetchall()
        }
        for v in STRAW_HAT_PACK:
            if v["title"] in existing:
                conn.execute(
                    """
                    UPDATE voyages
                    SET icon = ?, theme_keyword = ?, time_window = ?,
                        evidence_bonus_pct = ?, verification_mode = ?,
                        cooldown_sec = ?, description = ?,
                        verifier_prompt = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        v.get("icon"),
                        v.get("theme_keyword"),
                        v.get("time_window", "anytime"),
                        v.get("evidence_bonus_pct", 25),
                        v["verification_mode"],
                        v.get("cooldown_sec", 0),
                        v.get("description", ""),
                        v.get("verifier_prompt"),
                        ts,
                        existing[v["title"]],
                    ),
                )
                continue
            conn.execute(
                """
                INSERT INTO voyages (
                    title, description, haki_affinity, base_bounty, base_berries,
                    verification_mode, recurrence, cooldown_sec, category,
                    verifier_prompt, icon, theme_keyword,
                    time_window, evidence_bonus_pct,
                    active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                """,
                (
                    v["title"],
                    v.get("description", ""),
                    v["haki_affinity"],
                    v["base_bounty"],
                    v["base_berries"],
                    v["verification_mode"],
                    v["recurrence"],
                    v.get("cooldown_sec", 0),
                    v["category"],
                    v.get("verifier_prompt"),
                    v.get("icon"),
                    v.get("theme_keyword"),
                    v.get("time_window", "anytime"),
                    v.get("evidence_bonus_pct", 25),
                    ts,
                    ts,
                ),
            )
            inserted += 1
            voyage_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            if v["recurrence"] != "one_shot":
                conn.execute(
                    "INSERT OR IGNORE INTO log_pose (voyage_id) VALUES (?)",
                    (voyage_id,),
                )
    return inserted
