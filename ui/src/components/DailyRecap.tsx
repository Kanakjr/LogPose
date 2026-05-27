"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Flame, Gem, Sparkles, X } from "lucide-react";
import { crewOneLiner, getJournal } from "@/lib/api";
import type { VoyageDTO, VoyageLogDTO } from "@/lib/api";
import { PixelPortrait } from "@/components/PixelPortrait";
import { CREW_ACCENT, CREW_NAME, CREW_SPRITE } from "@/lib/sprites";

/**
 * One-shot daily summary modal. Fires when all of today's voyages are done
 * and the user hasn't been shown a recap yet today. Pulls per-day totals
 * from the journal (which is a thin read-view on voyage_log), shows the
 * highlights, and asks Robin for a one-line debrief.
 *
 * Persists `logpose:recap-shown:YYYY-MM-DD` so it shows at most once a day.
 */
export function DailyRecap({
  date,
  voyages,
}: {
  date: string;
  voyages: VoyageDTO[];
}) {
  const total = voyages.length;
  const done = voyages.filter((v) => v.done_today).length;
  const allDone = total > 0 && done === total;

  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<VoyageLogDTO[]>([]);
  const [line, setLine] = useState<string | null>(null);
  const requested = useRef(false);

  const storageKey = `logpose:recap-shown:${date}`;

  useEffect(() => {
    if (!allDone || !date) return;
    try {
      if (window.localStorage.getItem(storageKey)) return;
    } catch {
      // ignore; modal will still render
    }
    let cancelled = false;
    // Pull a window of the latest journal entries; we filter to today below.
    getJournal(undefined, 100)
      .then((j) => {
        if (cancelled) return;
        const todayStart = new Date(date + "T00:00:00").getTime() / 1000;
        setLogs(j.items.filter((it) => it.attempted_at >= todayStart));
        setOpen(true);
        try {
          window.localStorage.setItem(storageKey, String(Date.now()));
        } catch {
          // ignore
        }
      })
      .catch(() => {
        // Even without journal data we still want to celebrate.
        setOpen(true);
      });
    return () => {
      cancelled = true;
    };
  }, [allDone, date, storageKey]);

  // Robin gets the debrief (kenbun = analysis). Pull a one-liner the moment
  // the modal opens.
  useEffect(() => {
    if (!open || requested.current) return;
    requested.current = true;
    crewOneLiner("robin", "daily_recap", { date, done, total })
      .then((r) => setLine(r.content))
      .catch(() => setLine(null));
  }, [open, date, done, total]);

  const stats = useMemo(() => computeStats(logs, voyages), [logs, voyages]);

  function close() {
    setOpen(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          className="fixed inset-0 z-[55] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="daily-recap-title"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="surface relative m-4 w-full max-w-md overflow-hidden"
          >
            <button
              onClick={close}
              aria-label="Close"
              className="absolute right-2 top-2 rounded-md p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="space-y-4 px-5 py-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-300" />
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-300">
                  Day cleared
                </span>
              </div>
              <h2
                id="daily-recap-title"
                className="font-display text-xl font-semibold text-zinc-50"
              >
                Log Pose locked for {prettyDate(date)}
              </h2>

              <div className="grid grid-cols-2 gap-2">
                <Stat
                  label="Bounty earned"
                  value={`+${stats.bounty.toLocaleString()}`}
                  accent="#fbbf24"
                />
                <Stat
                  label="Berries"
                  value={`+${stats.berries}`}
                  accent="#facc15"
                />
                <Stat
                  label="Voyages"
                  value={`${done}/${total}`}
                  accent="#34d399"
                />
                <Stat
                  label="Top streak"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Flame className="h-3.5 w-3.5" />
                      {stats.topStreak}
                    </span>
                  }
                  accent="#fb923c"
                />
              </div>

              {stats.drops.length > 0 && (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-amber-300">
                    <Gem className="h-3 w-3" />
                    Salvaged
                  </div>
                  <ul className="mt-2 space-y-1">
                    {stats.drops.slice(0, 4).map((d, i) => (
                      <li key={i} className="text-sm text-zinc-200">
                        {d.name}
                        {d.rarity && (
                          <span className="ml-1 text-[10px] uppercase tracking-widest text-zinc-500">
                            {d.rarity.split("_")[0]}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <RobinNote line={line} />

              <div className="flex gap-2 pt-1">
                <Link
                  href="/journal"
                  onClick={close}
                  className="flex-1 rounded-full border border-white/10 px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-widest text-zinc-200 hover:bg-white/5"
                >
                  Open journal
                </Link>
                <button
                  onClick={close}
                  className="flex-1 rounded-full bg-amber-400 px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-900 hover:bg-amber-300"
                >
                  Done
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RobinNote({ line }: { line: string | null }) {
  const sprite = CREW_SPRITE.robin;
  const accent = CREW_ACCENT.robin;
  return (
    <div className="flex items-start gap-3 border-t border-white/5 pt-3">
      <PixelPortrait
        src={sprite.chip}
        size={32}
        rounded="rounded-lg"
        alt={CREW_NAME.robin}
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: accent }}
        >
          {CREW_NAME.robin}
        </div>
        <div className="min-h-[1.25rem] text-sm text-zinc-100">
          {line ?? <em className="text-zinc-500">debriefing...</em>}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-3">
      <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">
        {label}
      </div>
      <div
        className="mt-1 font-mono text-lg font-semibold tabular-nums"
        style={{ color: accent }}
      >
        {value}
      </div>
    </div>
  );
}

function computeStats(logs: VoyageLogDTO[], voyages: VoyageDTO[]) {
  const todaySuccessful = logs.filter((l) =>
    ["verified", "self_reported", "timer_done"].includes(l.verdict),
  );
  const bounty = todaySuccessful.reduce((a, l) => a + (l.bounty_awarded || 0), 0);
  const berries = todaySuccessful.reduce(
    (a, l) => a + (l.berries_awarded || 0),
    0,
  );
  const topStreak = voyages.reduce((m, v) => Math.max(m, v.streak?.current ?? 0), 0);
  const drops = todaySuccessful
    .filter((l) => l.drop_item_name)
    .map((l) => ({ name: l.drop_item_name as string, rarity: l.drop_rarity }));
  return { bounty, berries, topStreak, drops };
}

function prettyDate(d: string): string {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  } catch {
    return d;
  }
}
