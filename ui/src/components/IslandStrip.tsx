"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import type { GrandLineDTO } from "@/lib/api";
import { PixelPortrait } from "@/components/PixelPortrait";
import { spritePath } from "@/lib/sprites";

/**
 * One-line glance at the Grand Line: where the Captain is now, where the
 * compass is pointing, and how close they are. Links to /map for the full
 * journey.
 *
 * Renders only when we have map data; the home page treats it as a graceful
 * no-op while loading so the layout doesn't flicker.
 */
export function IslandStrip({ map }: { map: GrandLineDTO | null }) {
  if (!map) return null;
  const next = map.next_island;
  const pct = computeProgressPct(map);

  return (
    <Link
      href="/map"
      aria-label="Open the Grand Line map"
      className="group block"
    >
      <div className="surface flex items-center gap-3 px-3 py-2.5 transition hover:border-white/20">
        <PixelPortrait
          src={spritePath({ kind: "island", key: map.current_island })}
          size={40}
          rounded="rounded-xl"
          alt={map.current_island}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            Grand Line
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="font-display truncate font-semibold text-zinc-100">
              {map.current_island}
            </span>
            {next && (
              <>
                <ChevronRight className="h-3 w-3 shrink-0 text-zinc-600" />
                <span className="font-display truncate font-medium text-zinc-400">
                  {next.name}
                </span>
              </>
            )}
          </div>
          {next ? (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-400 to-rose-400"
                />
              </div>
              <span className="font-mono text-[10px] text-zinc-500">{pct}%</span>
            </div>
          ) : (
            <div className="mt-1 text-[11px] font-medium text-amber-300">
              Laugh Tale reached
            </div>
          )}
        </div>
        {next && (
          <PixelPortrait
            src={spritePath({ kind: "island", key: next.name })}
            size={40}
            rounded="rounded-xl"
            alt={next.name}
            className="opacity-60 transition group-hover:opacity-100"
          />
        )}
      </div>
    </Link>
  );
}

function computeProgressPct(map: GrandLineDTO): number {
  const next = map.next_island;
  if (!next) return 100;
  // Find the previous island threshold so we can show progress *between*
  // islands rather than against the absolute scale (which would always show
  // tiny numbers in the early game).
  const sorted = [...map.islands].sort((a, b) => a.order - b.order);
  const nextIdx = sorted.findIndex((i) => i.name === next.name);
  const prev = nextIdx > 0 ? sorted[nextIdx - 1] : null;
  const floor = prev?.threshold ?? 0;
  const ceil = next.threshold;
  if (ceil <= floor) return 0;
  const pct = ((map.bounty - floor) / (ceil - floor)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}
