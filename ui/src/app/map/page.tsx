"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Check, Lock, Star } from "lucide-react";
import { getMap } from "@/lib/api";
import type { GrandLineDTO } from "@/lib/api";
import { MagicCard } from "@/components/magicui/magic-card";
import { BorderBeam } from "@/components/magicui/border-beam";
import { AnimatedCircularProgressBar } from "@/components/magicui/animated-circular-progress-bar";
import { PixelPortrait } from "@/components/PixelPortrait";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { spritePath } from "@/lib/sprites";
import { cn } from "@/lib/utils";

export default function MapPage() {
  const [data, setData] = useState<GrandLineDTO | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMap()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="mt-16 text-center text-sm text-zinc-500">
        Unrolling the chart...
      </div>
    );
  if (!data) return null;

  const currentIdx = data.islands.findIndex((i) => i.current);
  const prevThreshold =
    currentIdx > 0 ? data.islands[currentIdx - 1].threshold : 0;
  const nextThreshold = data.next_island?.threshold ?? data.bounty;
  const segSize = Math.max(1, nextThreshold - prevThreshold);
  const segPos = Math.max(0, data.bounty - prevThreshold);
  const segPct = Math.min(100, Math.round((segPos / segSize) * 100));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="px-1">
        <h1 className="font-display text-2xl font-semibold text-zinc-50">
          Grand Line
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          Charted to {data.current_island}.
        </p>
      </header>

      {data.next_island && (
        <div className="surface flex items-center gap-4 px-4 py-4">
          <div className="relative shrink-0">
            <AnimatedCircularProgressBar
              value={segPct}
              gaugePrimaryColor="#f59e0b"
              gaugeSecondaryColor="rgba(255,255,255,0.06)"
              showPercent={false}
              className="size-20"
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="font-mono text-lg font-semibold text-amber-300">
                {segPct}%
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              Next island
            </div>
            <div className="font-display text-lg font-semibold text-zinc-50">
              {data.next_island.name}
            </div>
            <div className="mt-1 text-xs text-zinc-400">
              <span className="font-mono text-amber-300">
                <NumberTicker value={data.next_island.bounty_needed} />
              </span>
              {" "}more bounty to reach{" "}
              <span className="font-mono">{data.next_island.threshold_display}</span>
              .
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        {/* Spine */}
        <div className="absolute left-9 top-3 bottom-3 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />
        <div className="space-y-3">
          {data.islands.map((isl, i) => (
            <motion.div
              key={isl.name}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="relative flex items-stretch gap-3"
            >
              <div className="relative z-10 flex w-12 shrink-0 items-start justify-center pt-2">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-[11px] ring-2",
                    isl.current
                      ? "bg-amber-400 text-zinc-900 ring-amber-300/40 shadow-[0_0_20px_2px_rgba(250,204,21,0.35)]"
                      : isl.unlocked
                        ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30"
                        : "bg-white/[0.04] text-zinc-500 ring-white/10",
                  )}
                >
                  {isl.current ? (
                    <Star className="h-3.5 w-3.5" fill="currentColor" />
                  ) : isl.unlocked ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Lock className="h-3 w-3" />
                  )}
                </div>
              </div>

              <div className="relative flex-1">
                <MagicCard
                  className={cn(
                    "p-3",
                    !isl.unlocked && !isl.current && "opacity-60",
                  )}
                  gradientFrom={isl.current ? "#facc15" : "#6366f1"}
                  gradientTo={isl.current ? "#fb7185" : "#06b6d4"}
                >
                  {isl.current && <BorderBeam size={50} duration={6} />}
                  <div className="flex items-center gap-3">
                    <PixelPortrait
                      src={spritePath({ kind: "island", key: isl.name })}
                      size={44}
                      rounded="rounded-xl"
                      alt={isl.name}
                    />
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          "font-display text-base font-semibold",
                          isl.current
                            ? "text-amber-300"
                            : isl.unlocked
                              ? "text-zinc-100"
                              : "text-zinc-500",
                        )}
                      >
                        {isl.name}
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        <span className="font-mono">{isl.threshold_display}</span> bounty
                      </div>
                    </div>
                    {isl.current && (
                      <span className="rounded-full bg-amber-400/15 px-2 py-1 text-[10px] uppercase tracking-widest text-amber-300">
                        Here
                      </span>
                    )}
                  </div>
                </MagicCard>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
