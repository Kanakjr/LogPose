"use client";

import type { CaptainDTO, Haki } from "@/lib/api";
import { AnimatedCircularProgressBar } from "@/components/magicui/animated-circular-progress-bar";
import { Term } from "@/components/Term";
import { HAKI_ACCENT, HAKI_LABEL } from "@/lib/sprites";

const KEYS: Haki[] = ["buso", "vitality", "kenbun", "haoshoku"];

/**
 * 4-up grid of small circular progress rings for each Haki stat. Replaces the
 * old SVG radar with something that maps cleanly to per-stat progress and
 * matches the Habitica-style ring language.
 */
export function HakiRings({ captain }: { captain: CaptainDTO }) {
  const top = Math.max(10, ...KEYS.map((k) => captain.haki[k].level));
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3">
      {KEYS.map((k) => {
        const level = captain.haki[k].level;
        const color = HAKI_ACCENT[k];
        return (
          <div
            key={k}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/5 bg-white/[0.03] py-3"
          >
            <AnimatedCircularProgressBar
              value={level}
              min={0}
              max={top}
              gaugePrimaryColor={color}
              gaugeSecondaryColor="rgba(255,255,255,0.06)"
              showPercent={false}
              className="size-16"
            />
            <div className="-mt-12 flex flex-col items-center">
              <span
                className="font-mono text-base font-semibold leading-none"
                style={{ color }}
                aria-label={`${HAKI_LABEL[k]} Haki, level ${level}`}
              >
                {level}
              </span>
              <span className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-zinc-500">
                Lv
              </span>
            </div>
            <span className="mt-1 text-[11px] font-medium uppercase tracking-wider text-zinc-300">
              <Term k={k}>{HAKI_LABEL[k]}</Term>
            </span>
          </div>
        );
      })}
    </div>
  );
}
