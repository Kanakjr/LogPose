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

export type SpriteKey =
  | { kind: "crew"; key: CrewKey }
  | { kind: "captain"; tier: 1 | 2 | 3 | 4 | 5 }
  | { kind: "fruit"; key: "gomu" | "mera" | "yami" | "hito" }
  | { kind: "chest"; key: "wood" | "silver" | "gold" }
  | { kind: "island"; key: string }
  | { kind: "voyage"; key: "sun" | "sword" | "quill" }
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

// Voyage category -> icon sprite
export function voyageCategoryIcon(category: string | undefined): SpriteKey {
  if (category === "straw_hat_ritual") return { kind: "voyage", key: "sun" };
  if (category === "crew_duty") return { kind: "voyage", key: "quill" };
  return { kind: "voyage", key: "sword" };
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
