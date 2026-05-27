export function formatBounty(b: number): string {
  return `B ${b.toLocaleString("en-IN")}`;
}

export function formatBerries(n: number): string {
  return `${n.toLocaleString("en-IN")} berries`;
}

export function shortRelative(ts: number): string {
  const d = new Date(ts * 1000);
  const diff = (Date.now() - ts * 1000) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86_400) return `${Math.floor(diff / 86_400)}d ago`;
  return d.toLocaleDateString();
}

export const HAKI_LABELS: Record<string, string> = {
  buso: "Armament",
  vitality: "Vitality",
  kenbun: "Observation",
  haoshoku: "Conqueror's",
};

export const HAKI_COLORS: Record<string, string> = {
  buso: "haki-buso",
  vitality: "haki-vitality",
  kenbun: "haki-kenbun",
  haoshoku: "haki-haoshoku",
};

export const HAKI_BG: Record<string, string> = {
  buso: "haki-buso-bg",
  vitality: "haki-vitality-bg",
  kenbun: "haki-kenbun-bg",
  haoshoku: "haki-haoshoku-bg",
};

export const RARITY_LABELS: Record<string, string> = {
  common: "Common",
  rare_cursed_blade: "Rare Cursed Blade",
  legendary_ancient_weapon: "Legendary Ancient Weapon",
  mythic_devil_fruit: "Mythic Devil Fruit",
};

export const RARITY_COLORS: Record<string, string> = {
  common: "#94a3b8",
  rare_cursed_blade: "#6ec1e4",
  legendary_ancient_weapon: "#d4af37",
  mythic_devil_fruit: "#c0392b",
};
