// Centralised sprite paths. All sprites are real PNGs generated with
// gemini-2.5-flash-image using the chibi crew portraits as style reference
// (see scripts/generate_sprites.py + scripts/process_crew_avatars.py).

const SPRITE_BASE = "/sprites";

type CrewKey = "luffy" | "zoro" | "nami" | "robin" | "chopper";

export const CREW_SPRITE: Record<CrewKey, { full: string; chip: string }> = {
  luffy: { full: `${SPRITE_BASE}/crew/luffy.png`, chip: `${SPRITE_BASE}/crew/luffy.32.png` },
  zoro: { full: `${SPRITE_BASE}/crew/zoro.png`, chip: `${SPRITE_BASE}/crew/zoro.32.png` },
  nami: { full: `${SPRITE_BASE}/crew/nami.png`, chip: `${SPRITE_BASE}/crew/nami.32.png` },
  robin: { full: `${SPRITE_BASE}/crew/robin.png`, chip: `${SPRITE_BASE}/crew/robin.32.png` },
  chopper: { full: `${SPRITE_BASE}/crew/chopper.png`, chip: `${SPRITE_BASE}/crew/chopper.32.png` },
};

// Tuned to match the dominant tile background in
// public/sprites/crew/*.png so the chat-bubble accent ring matches the
// portrait it points to.
export const CREW_ACCENT: Record<CrewKey, string> = {
  luffy: "#8fbf90",
  zoro: "#94adc4",
  nami: "#e5cf6c",
  robin: "#b594c8",
  chopper: "#e598ad",
};

export const CREW_NAME: Record<CrewKey, string> = {
  luffy: "Luffy",
  zoro: "Zoro",
  nami: "Nami",
  robin: "Robin",
  chopper: "Chopper",
};

export const CREW_ROLE: Record<CrewKey, string> = {
  luffy: "Motivator",
  zoro: "Trainer",
  nami: "Navigator",
  robin: "Critic",
  chopper: "Medic",
};

export type VoyageIcon =
  | "sun"
  | "sword"
  | "quill"
  | "water"
  | "pill"
  | "brew"
  | "meal"
  | "bike"
  | "cold"
  | "boots"
  | "moon"
  | "phone-down"
  | "book"
  | "den-den-mushi"
  | "scroll";

export type SpriteKey =
  | { kind: "crew"; key: CrewKey }
  | { kind: "captain"; tier: 1 | 2 | 3 | 4 | 5 }
  | { kind: "fruit"; key: "gomu" | "mera" | "yami" | "hito" }
  | { kind: "chest"; key: "wood" | "silver" | "gold" }
  | { kind: "island"; key: string }
  | { kind: "voyage"; key: VoyageIcon }
  | { kind: "compass" }
  | { kind: "den-den-mushi" };

export function spritePath(s: SpriteKey): string {
  switch (s.kind) {
    case "crew":
      return CREW_SPRITE[s.key].full;
    case "captain":
      return `${SPRITE_BASE}/captain/tier-${s.tier}.png`;
    case "fruit":
      return `${SPRITE_BASE}/devil-fruits/${s.key}.png`;
    case "chest":
      return `${SPRITE_BASE}/chests/${s.key}.png`;
    case "island":
      return `${SPRITE_BASE}/islands/${slugify(s.key)}.png`;
    case "voyage":
      // The den-den-mushi sprite already exists at the root and is reused
      // by voyages that thematically map to "reach out to someone".
      if (s.key === "den-den-mushi") return `${SPRITE_BASE}/den-den-mushi.png`;
      return `${SPRITE_BASE}/voyages/${s.key}.png`;
    case "compass":
      return `${SPRITE_BASE}/app-icon.png`;
    case "den-den-mushi":
      return `${SPRITE_BASE}/den-den-mushi.png`;
  }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

// Captain tier ladder (keys come from backend tier.key)
const TIER_INDEX: Record<string, 1 | 2 | 3 | 4 | 5> = {
  rookie: 1,
  supernova: 2,
  warlord: 3,
  yonko_commander: 4,
  yonko: 5,
  pirate_king: 5,
};

export function captainTier(key: string): 1 | 2 | 3 | 4 | 5 {
  return TIER_INDEX[key] ?? 2;
}

// Voyage category -> coarse icon. Used as a fallback when title-matching
// turns up nothing.
export function voyageCategoryIcon(category: string | undefined): SpriteKey {
  if (category === "straw_hat_ritual") return { kind: "voyage", key: "sun" };
  if (category === "crew_duty") return { kind: "voyage", key: "quill" };
  return { kind: "voyage", key: "sword" };
}

// Title-keyword -> voyage icon. We scan voyage titles + descriptions for
// distinctive nouns and route them to a meaningful pixel sprite. Order
// matters - first match wins, so put the most specific terms first.
const VOYAGE_KEYWORD_MAP: Array<[RegExp, VoyageIcon]> = [
  // Vitality
  [/\b(thyronorm|tablet|pill|med|medication|meds)\b/i, "pill"],
  [/\b(water|hydration|electrolyte|ration|drink)\b/i, "water"],
  [/\b(brew|coffee|caffeine|tea|espresso)\b/i, "brew"],
  [/\b(meal|sanji's meal|breakfast|lunch|dinner|plate|protein|eat)\b/i, "meal"],
  [/\b(dawn|sunrise|morning sky|sunlight|outside.*morning|set sail)\b/i, "sun"],

  // Buso
  [/\b(zone 2|cardio|cycle|cycling|treadmill|bike|brisk walk)\b/i, "bike"],
  [/\b(cold|drum island|shower|plunge|ice|chill)\b/i, "cold"],
  [/\b(walk|island exploration|stroll|step|hike)\b/i, "boots"],

  // Haoshoku
  [/\b(nsdr|nap|rest|sunny rest|sleep|yoga nidra|meditation)\b/i, "moon"],
  [/\b(scroll|sirens|doom|screen.?time|phone|distract)\b/i, "phone-down"],
  [/\b(den den mushi|friend|family|call|reach out|message)\b/i, "den-den-mushi"],

  // Kenbun
  [/\b(read|kindle|codex|book|chapter|page)\b/i, "book"],
  [/\b(scholar|ohara|duolingo|language|japanese|lesson)\b/i, "scroll"],
];

// Walks the keyword map and returns the first matching icon, or falls back
// to the category icon. Prefers explicit voyage.icon if the backend has it.
export function voyageIcon(
  voyage: { title: string; description?: string; category?: string; icon?: string | null },
): SpriteKey {
  if (voyage.icon) return { kind: "voyage", key: voyage.icon as VoyageIcon };
  const hay = `${voyage.title} ${voyage.description ?? ""}`;
  for (const [re, key] of VOYAGE_KEYWORD_MAP) {
    if (re.test(hay)) return { kind: "voyage", key };
  }
  return voyageCategoryIcon(voyage.category);
}

// Crew accents reused by the chat surface
export const HAKI_ACCENT: Record<string, string> = {
  buso: "#ef4444",
  vitality: "#22c55e",
  kenbun: "#38bdf8",
  haoshoku: "#facc15",
};

export const HAKI_LABEL: Record<string, string> = {
  buso: "Buso",
  vitality: "Vitality",
  kenbun: "Kenbun",
  haoshoku: "Haoshoku",
};
