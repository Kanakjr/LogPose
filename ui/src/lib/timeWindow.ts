// Time-of-day bucketing for the Daily Voyages list. Everything is computed
// against Asia/Kolkata regardless of the device timezone, because that's the
// Captain's actual clock.

import type { TimeWindow, VoyageDTO } from "@/lib/api";

export const TIME_WINDOWS: TimeWindow[] = [
  "morning",
  "midday",
  "evening",
  "night",
  "anytime",
];

export const WINDOW_LABEL: Record<TimeWindow, string> = {
  morning: "Morning",
  midday: "Midday",
  evening: "Evening",
  night: "Night",
  anytime: "Anytime",
};

export const WINDOW_HINT: Record<TimeWindow, string> = {
  morning: "4:00 - 12:00",
  midday: "12:00 - 17:00",
  evening: "17:00 - 21:00",
  night: "21:00 - 4:00",
  anytime: "Whenever it fits",
};

// Distinct accent per window so the eye can scan them fast.
export const WINDOW_ACCENT: Record<TimeWindow, string> = {
  morning: "#fbbf24",
  midday: "#fb923c",
  evening: "#a78bfa",
  night: "#60a5fa",
  anytime: "#a1a1aa",
};

// Pixel sprite mapping for each header. Reuses existing voyage sprites for
// continuity with the rail.
export const WINDOW_SPRITE: Record<TimeWindow, string> = {
  morning: "voyages/sun.png",
  midday: "voyages/brew.png",
  evening: "voyages/boots.png",
  night: "voyages/moon.png",
  anytime: "voyages/scroll.png",
};

// Pick the current window from a Date, evaluated in Asia/Kolkata.
export function currentWindow(now: Date = new Date()): TimeWindow {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    hour12: false,
  });
  const hour = parseInt(fmt.format(now), 10);
  if (Number.isNaN(hour)) return "anytime";
  if (hour >= 4 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "midday";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

export type VoyageGroup = {
  window: TimeWindow;
  voyages: VoyageDTO[];
  done: number;
  total: number;
  isCurrent: boolean;
};

// Group voyages by time_window, in canonical order, dropping windows that
// have no voyages. "Anytime" always appears last regardless of the current
// hour because it never lights up as "now".
export function groupVoyages(
  voyages: VoyageDTO[],
  now: Date = new Date(),
): VoyageGroup[] {
  const current = currentWindow(now);
  const buckets = new Map<TimeWindow, VoyageDTO[]>();
  for (const v of voyages) {
    const w = (v.time_window ?? "anytime") as TimeWindow;
    if (!buckets.has(w)) buckets.set(w, []);
    buckets.get(w)!.push(v);
  }
  const out: VoyageGroup[] = [];
  for (const w of TIME_WINDOWS) {
    const list = buckets.get(w);
    if (!list || list.length === 0) continue;
    const done = list.filter((v) => v.done_today).length;
    out.push({
      window: w,
      voyages: list,
      done,
      total: list.length,
      isCurrent: w === current,
    });
  }
  return out;
}
