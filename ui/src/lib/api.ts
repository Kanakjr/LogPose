// Thin fetch wrappers that hit /api/game/* (game backend) and /api/crew/*
// (crew service). All real auth happens server-side in middleware.ts.

export type Haki = "buso" | "vitality" | "kenbun" | "haoshoku";

export type CaptainDTO = {
  name: string;
  bounty: number;
  bounty_display: string;
  berries: number;
  morale: { current: number; max: number };
  haki: Record<Haki, { level: number; label: string }>;
  tier: { key: string; label: string; threshold: number };
  tier_ladder: { key: string; label: string; threshold: number }[];
  current_island: string;
  next_island: { name: string; threshold: number } | null;
};

export type TimeWindow = "morning" | "midday" | "evening" | "night" | "anytime";

export type VoyageDTO = {
  id: number;
  title: string;
  description: string;
  haki_affinity: Haki;
  base_bounty: number;
  base_berries: number;
  verification_mode: "self" | "marine_photo" | "timer" | "stillness";
  recurrence: "daily" | "weekly" | "one_shot";
  cooldown_sec: number;
  category: string;
  verifier_prompt: string | null;
  icon: string | null;
  theme_keyword: string | null;
  time_window: TimeWindow;
  evidence_bonus_pct: number;
  active: boolean;
  done_today?: boolean;
  today_attempt?: VoyageLogDTO | null;
  streak?: {
    current: number;
    longest: number;
    last_completed_date: string | null;
  };
};

export type VoyageLogDTO = {
  id: number;
  voyage_id: number;
  attempted_at: number;
  completed_at: number | null;
  verdict: string;
  marine_reasoning: string | null;
  confidence: number | null;
  bounty_awarded: number;
  berries_awarded: number;
  drop_item_id: number | null;
  image_path: string | null;
  title?: string;
  haki_affinity?: Haki;
  category?: string;
  drop_item_name?: string | null;
  drop_rarity?: string | null;
  drop_lore?: string | null;
};

export type Drop = {
  kind: "nothing" | "berries_multiplier" | "item";
  rarity?: string;
  item_name?: string;
  lore_text?: string;
  haki_bonus?: string;
  berries_multiplier?: number;
  bonus_berries?: number;
  item_id?: number | null;
};

export type AttemptResult = {
  log_id: number;
  verdict: string;
  reasoning: string;
  confidence: number;
  bounty_awarded: number;
  berries_awarded: number;
  bonus_bounty: number;
  bonus_berries: number;
  bonus_applied: boolean;
  evidence_bonus_pct: number;
  drop: Drop;
  captain: CaptainDTO | null;
  streak: { current_streak: number; longest_streak: number; last_completed_date: string } | null;
  tier_up: { from: string; to: string } | null;
  image_path: string | null;
};

export type GrandLineDTO = {
  bounty: number;
  bounty_display: string;
  current_island: string;
  next_island: {
    name: string;
    threshold: number;
    threshold_display: string;
    bounty_needed: number;
  } | null;
  islands: {
    name: string;
    order: number;
    threshold: number;
    threshold_display: string;
    unlocked: boolean;
    current: boolean;
  }[];
};

export type TreasureGroup = {
  rarity: string;
  label: string;
  items: {
    id: number;
    item_name: string;
    rarity: string;
    lore_text: string | null;
    haki_bonus: string | null;
    acquired_at: number;
    equipped: number;
  }[];
};

const GAME = "/api/game";
const CREW = "/api/crew";

async function get<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

export async function getCaptain(): Promise<CaptainDTO> {
  return get(`${GAME}/captain`);
}

export async function getVoyagesToday(): Promise<{ date: string; voyages: VoyageDTO[] }> {
  return get(`${GAME}/voyages/today`);
}

export async function getVoyages(): Promise<{ voyages: VoyageDTO[] }> {
  return get(`${GAME}/voyages`);
}

export async function getVoyage(id: number): Promise<VoyageDTO> {
  return get(`${GAME}/voyages/${id}`);
}

export async function getJournal(
  cursor?: number | null,
  limit = 50
): Promise<{ items: VoyageLogDTO[]; has_more: boolean; next_cursor: number | null }> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set("since", String(cursor));
  return get(`${GAME}/journal?${params}`);
}

export async function getTreasure(): Promise<{ groups: TreasureGroup[]; total: number }> {
  return get(`${GAME}/treasure`);
}

export async function getMap(): Promise<GrandLineDTO> {
  return get(`${GAME}/map`);
}

export async function attemptVoyage(
  voyageId: number,
  payload: { mode: string; image?: File }
): Promise<AttemptResult> {
  const fd = new FormData();
  fd.append("mode", payload.mode);
  if (payload.image) fd.append("image", payload.image);
  const r = await fetch(`${GAME}/voyages/${voyageId}/attempt`, {
    method: "POST",
    body: fd,
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`attempt failed: ${r.status} ${text}`);
  }
  return r.json();
}

// --- Crew (used on /crew page) ---

export type CrewListDTO = {
  crew: { key: string; name: string; role: string; voice: string; online: boolean }[];
};

export type CrewBlock = { agent: string; content: string };

export async function getCrew(): Promise<CrewListDTO> {
  return get(`${CREW}`);
}

export async function getCrewHistory(
  crewmate: string,
  limit = 50
): Promise<{
  history: { role: string; crewmate: string | null; content: string; ts: number }[];
}> {
  return get(`${CREW}/${crewmate}/history?limit=${limit}`);
}

export async function getNudges(): Promise<{
  nudges: { crewmate: string; content: string; ts: number; reason: string }[];
}> {
  return get(`${CREW}/nudges`);
}

export async function crewOneLiner(
  crewmate: string,
  intent: string,
  payload: Record<string, unknown> = {},
): Promise<{ crewmate: string; content: string }> {
  const r = await fetch(`${CREW}/${crewmate}/one_liner`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent, payload }),
  });
  if (!r.ok) throw new Error(`one_liner failed: ${r.status}`);
  return r.json();
}

// SSE chat helper. Returns an async iterator of (event, data) tuples.
export async function* streamCrewChat(opts: {
  crewmate?: string; // omit for group / Den Den Mushi
  message: string;
  thread_key?: string;
}): AsyncGenerator<{ event: string; data: Record<string, unknown> }, void, void> {
  const url = opts.crewmate
    ? `${CREW}/${opts.crewmate}/chat`
    : `${CREW}/chat`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: opts.message,
      thread_key: opts.thread_key ?? null,
    }),
  });
  if (!r.body) throw new Error("no SSE body");
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const lines = chunk.split("\n");
      let event = "message";
      let dataLine = "";
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
      }
      if (!dataLine) continue;
      try {
        yield { event, data: JSON.parse(dataLine) };
      } catch {
        // ignore malformed
      }
    }
  }
}
