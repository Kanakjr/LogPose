"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Camera, CheckCircle2, Clock, Flame, Sparkles, Wind } from "lucide-react";
import type { VoyageDTO } from "@/lib/api";
import { PixelPortrait } from "@/components/PixelPortrait";
import { HAKI_ACCENT, HAKI_LABEL, spritePath, voyageIcon } from "@/lib/sprites";
import { cn } from "@/lib/utils";

const VERIFICATION_LABEL: Record<string, { icon: typeof Camera; copy: string }> = {
  marine_photo: { icon: Camera, copy: "Snap proof" },
  self: { icon: CheckCircle2, copy: "Mark done" },
  timer: { icon: Clock, copy: "Start timer" },
  stillness: { icon: Wind, copy: "Sit still" },
};

/**
 * The single most important card on the dashboard: a short-circuit straight
 * to the next voyage the Captain hasn't cleared. Larger pixel art, an
 * obvious CTA, a hint of the next reward. Hidden when everything is done
 * (the All Done state owns that real-estate instead).
 */
export function NextUpCard({ voyage }: { voyage: VoyageDTO | null }) {
  if (!voyage) return <AllDoneCard />;
  const haki = HAKI_ACCENT[voyage.haki_affinity];
  const icon = voyageIcon(voyage);
  const ver = VERIFICATION_LABEL[voyage.verification_mode] ?? VERIFICATION_LABEL.self;
  const VerifyIcon = ver.icon;
  const streak = voyage.streak?.current ?? 0;

  return (
    <Link href={`/voyages/${voyage.id}`} className="block">
      <motion.div
        whileTap={{ scale: 0.98 }}
        whileHover={{ y: -2 }}
        className="surface group relative overflow-hidden px-4 py-4 transition hover:border-amber-300/30"
      >
        <span
          className="absolute left-0 top-3 bottom-3 w-1 rounded-full"
          style={{ background: haki }}
        />
        <div className="flex items-center gap-4">
          <PixelPortrait
            src={spritePath(icon)}
            size={72}
            rounded="rounded-2xl"
            alt=""
            className="ml-1 shrink-0"
            idle
          />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
              Next up
            </div>
            <h2 className="font-display truncate text-lg font-semibold text-zinc-50">
              {voyage.title}
            </h2>
            <p className="mt-0.5 line-clamp-1 text-xs text-zinc-400">
              {voyage.description}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
              <span className="font-mono text-amber-300/90">
                +{voyage.base_bounty.toLocaleString()}
                <span className="ml-1 text-[9px] uppercase tracking-widest text-amber-300/60">XP</span>
              </span>
              <span className="text-zinc-700">·</span>
              <span className="font-mono text-amber-200/80">
                +{voyage.base_berries}
                <span className="ml-1 text-[9px] uppercase tracking-widest text-amber-200/60">berries</span>
              </span>
              <span className="text-zinc-700">·</span>
              <span
                className="font-medium uppercase tracking-wider"
                style={{ color: haki, fontSize: 10, letterSpacing: "0.1em" }}
              >
                {HAKI_LABEL[voyage.haki_affinity]}
              </span>
              {streak > 0 && (
                <span className="flex items-center gap-0.5 rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-300">
                  <Flame className="h-2.5 w-2.5" />
                  {streak}
                </span>
              )}
            </div>
          </div>
          <div
            className={cn(
              "hidden shrink-0 sm:flex sm:flex-col sm:items-end sm:gap-1",
            )}
          >
            <span className="flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-900 transition group-hover:bg-amber-300">
              <VerifyIcon className="h-3 w-3" />
              {ver.copy}
              <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>
        {/* Mobile CTA - icon-only doesn't read well, so we get a full pill
            below the row on small screens. */}
        <div className="mt-3 flex sm:hidden">
          <span className="flex w-full items-center justify-center gap-1.5 rounded-full bg-amber-400 px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-900">
            <VerifyIcon className="h-3 w-3" />
            {ver.copy}
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </motion.div>
    </Link>
  );
}

function AllDoneCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="surface flex items-center gap-3 px-4 py-4"
    >
      <Sparkles className="h-6 w-6 shrink-0 text-amber-300" />
      <div className="min-w-0 flex-1">
        <div className="font-display text-sm font-semibold text-zinc-50">
          Log Pose locked.
        </div>
        <p className="text-xs text-zinc-400">
          Every voyage done. The compass swings to the next island.
        </p>
      </div>
      <Link
        href="/crew"
        className="shrink-0 rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-amber-200 hover:bg-amber-400/20"
      >
        Review with crew
      </Link>
    </motion.div>
  );
}
