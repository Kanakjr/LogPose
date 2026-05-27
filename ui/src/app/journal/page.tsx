"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { CheckCircle2, XCircle, X } from "lucide-react";
import { getJournal } from "@/lib/api";
import type { VoyageLogDTO } from "@/lib/api";
import { MagicCard } from "@/components/magicui/magic-card";
import { PixelPortrait } from "@/components/PixelPortrait";
import { HAKI_ACCENT, spritePath } from "@/lib/sprites";

function fmtTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const RARITY_COLOR: Record<string, string> = {
  common: "#94a3b8",
  rare_cursed_blade: "#60a5fa",
  legendary_ancient_weapon: "#a855f7",
  mythic_devil_fruit: "#f59e0b",
};

export default function JournalPage() {
  const [items, setItems] = useState<VoyageLogDTO[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (since: number | null) => {
    setLoading(true);
    try {
      const r = await getJournal(since);
      setItems((prev) => (since === null ? r.items : [...prev, ...r.items]));
      setCursor(r.next_cursor);
      setHasMore(r.has_more);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(null);
  }, [load]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && hasMore && !loading) {
          load(cursor);
        }
      },
      { rootMargin: "200px" },
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [cursor, hasMore, loading, load]);

  const grouped = new Map<string, VoyageLogDTO[]>();
  for (const it of items) {
    const day = new Date(it.attempted_at * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day)!.push(it);
  }

  return (
    <div className="space-y-5">
      <header className="px-1">
        <h1 className="font-display text-2xl font-semibold text-zinc-50">
          Journal
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          Every voyage attempt, every drop, every verdict.
        </p>
      </header>

      {grouped.size === 0 && loading && (
        <div className="surface space-y-2 px-4 py-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex animate-pulse items-start gap-3 rounded-2xl bg-white/[0.02] px-3 py-3"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="h-7 w-1 rounded-full bg-white/5" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 rounded bg-white/5" />
                <div className="h-2 w-1/3 rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      )}
      {grouped.size === 0 && !loading && (
        <div className="surface px-4 py-10 text-center">
          <div className="mx-auto mb-3 flex w-fit">
            <PixelPortrait
              src={spritePath({ kind: "voyage", key: "scroll" })}
              size={72}
              rounded="rounded-2xl"
              alt="An empty scroll"
              idle
            />
          </div>
          <div className="font-display text-sm text-zinc-200">
            The logbook is blank.
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Verify your first voyage and the journal writes itself.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center gap-1 rounded-full bg-amber-400 px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-900 hover:bg-amber-300"
          >
            Find a voyage
          </Link>
        </div>
      )}

      {Array.from(grouped.entries()).map(([day, list]) => (
        <section key={day} className="space-y-2">
          <h2 className="sticky top-12 z-10 -mx-4 bg-zinc-950/80 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500 backdrop-blur lg:-mx-0 lg:rounded-lg lg:px-3">
            {day}
          </h2>
          <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
            {list.map((it) => {
              const ok = ["verified", "self_reported", "timer_done"].includes(it.verdict);
              const accent = HAKI_ACCENT[it.haki_affinity ?? "vitality"];
              const rarityColor = RARITY_COLOR[it.drop_rarity ?? "common"];
              return (
                <motion.div
                  key={it.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <MagicCard
                    className="p-3"
                    gradientFrom={ok ? "#facc15" : "#fb7185"}
                    gradientTo={ok ? "#fb7185" : "#7f1d1d"}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-1 h-7 w-1 shrink-0 rounded-full"
                        style={{ background: accent }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="font-display truncate text-sm font-semibold text-zinc-100">
                            {it.title}
                          </h3>
                          <time className="shrink-0 font-mono text-[10px] text-zinc-500">
                            {fmtTime(it.attempted_at)}
                          </time>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                          <span
                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold uppercase tracking-widest ${
                              ok
                                ? "bg-amber-400/15 text-amber-300"
                                : "bg-rose-500/15 text-rose-300"
                            }`}
                          >
                            {ok ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            {it.verdict.replace("_", " ")}
                          </span>
                          {ok && (
                            <>
                              <span className="font-mono text-amber-300/80">
                                +{it.bounty_awarded.toLocaleString()}
                              </span>
                              <span className="text-zinc-600">·</span>
                              <span className="font-mono text-sky-300/80">
                                +{it.berries_awarded}
                              </span>
                            </>
                          )}
                        </div>
                        {it.marine_reasoning && (
                          <p className="mt-2 line-clamp-3 text-xs italic text-zinc-400">
                            &ldquo;{it.marine_reasoning}&rdquo;
                          </p>
                        )}
                        {it.drop_item_name && (
                          <div
                            className="mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest"
                            style={{
                              color: rarityColor,
                              background: `${rarityColor}15`,
                            }}
                          >
                            {it.drop_item_name}
                          </div>
                        )}
                        {it.image_path && (
                          <button
                            onClick={() => setLightbox(`/media/${it.image_path}`)}
                            className="mt-2 block"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/media/${it.image_path}`}
                              alt="evidence"
                              className="h-24 rounded-lg object-cover transition hover:opacity-80"
                            />
                          </button>
                        )}
                      </div>
                    </div>
                  </MagicCard>
                </motion.div>
              );
            })}
          </div>
        </section>
      ))}

      <div ref={sentinelRef} className="h-10" />
      {loading && (
        <div className="text-center text-xs text-zinc-500">Loading more...</div>
      )}
      {!hasMore && items.length > 0 && (
        <div className="text-center text-xs text-zinc-500">
          End of the logbook.
        </div>
      )}

      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur"
          >
            <button
              onClick={() => setLightbox(null)}
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-zinc-100"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={lightbox}
              alt="evidence"
              className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
