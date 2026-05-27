"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import type { VoyageDTO } from "@/lib/api";
import { VoyageRail } from "@/components/VoyageRail";
import { PixelPortrait } from "@/components/PixelPortrait";
import { spritePath } from "@/lib/sprites";
import {
  groupVoyages,
  WINDOW_ACCENT,
  WINDOW_HINT,
  WINDOW_LABEL,
  WINDOW_SPRITE,
} from "@/lib/timeWindow";
import { cn } from "@/lib/utils";

/**
 * Grouped daily-voyage rail. Buckets each voyage by `time_window`
 * (morning / midday / evening / night / anytime in Asia/Kolkata) and
 * highlights the current window's header so the eye lands on "what to do
 * right now" first. Done voyages render inside their group sorted to the
 * bottom (struck through) instead of being hidden, so the list never
 * suddenly shrinks under you.
 */
export function VoyageGroups({
  voyages,
  hrefBase = "/voyages",
}: {
  voyages: VoyageDTO[];
  hrefBase?: string;
}) {
  const groups = useMemo(() => groupVoyages(voyages), [voyages]);

  if (voyages.length === 0) {
    return (
      <div className="surface px-4 py-6 text-center text-sm text-zinc-500">
        No voyages scheduled. Ask the crew on the Den Den Mushi.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const accent = WINDOW_ACCENT[g.window];
        const cleared = g.done === g.total;
        // Sort undone first, done last (so the "in flight" rows always lead).
        const ordered = [...g.voyages].sort((a, b) => {
          if (!!a.done_today === !!b.done_today) return 0;
          return a.done_today ? 1 : -1;
        });
        return (
          <section key={g.window} className="space-y-2">
            <motion.header
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex items-center gap-2.5 rounded-2xl border px-2.5 py-2",
                g.isCurrent
                  ? "border-white/15 bg-white/[0.04]"
                  : "border-white/5 bg-transparent",
              )}
            >
              <PixelPortrait
                src={spritePath(WINDOW_SPRITE[g.window])}
                size={28}
                rounded="rounded-lg"
                alt=""
                className="shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <h3
                    className="font-display text-[13px] font-semibold uppercase tracking-widest"
                    style={{ color: accent }}
                  >
                    {WINDOW_LABEL[g.window]}
                  </h3>
                  {g.isCurrent && (
                    <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-amber-300">
                      Now
                    </span>
                  )}
                  <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                    {g.done}/{g.total}
                  </span>
                </div>
                <p className="text-[10px] uppercase tracking-widest text-zinc-500">
                  {WINDOW_HINT[g.window]}
                  {cleared && (
                    <span className="ml-2 text-amber-300/80">cleared</span>
                  )}
                </p>
              </div>
            </motion.header>

            <div className="flex flex-col gap-2">
              {ordered.map((v) => (
                <VoyageRail
                  key={v.id}
                  voyage={v}
                  href={`${hrefBase}/${v.id}`}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
