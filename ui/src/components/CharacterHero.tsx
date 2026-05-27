"use client";

import type { CaptainDTO } from "@/lib/api";
import { PixelPortrait } from "@/components/PixelPortrait";
import { StatBar } from "@/components/StatBar";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { BorderBeam } from "@/components/magicui/border-beam";
import { captainTier, spritePath } from "@/lib/sprites";

/**
 * Habitica-style "hero" card: pixel portrait of the captain on the left, name
 * + tier + bounty + morale on the right. A subtle BorderBeam runs around the
 * card.
 */
export function CharacterHero({ captain }: { captain: CaptainDTO }) {
  const tier = captainTier(captain.tier.key);
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-zinc-950/80 p-4 backdrop-blur">
      <BorderBeam size={120} duration={9} colorFrom="#facc15" colorTo="#fb7185" />
      <div className="flex items-start gap-4">
        <PixelPortrait
          src={spritePath({ kind: "captain", tier })}
          alt={`${captain.name} portrait`}
          size={96}
          rounded="rounded-2xl"
          idle
        />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
            Captain
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h1 className="font-display truncate text-2xl font-semibold text-zinc-50">
              {captain.name}
            </h1>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
              {captain.tier.label}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            Sailing {captain.current_island}
          </div>
          <div className="mt-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Bounty
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-2xl font-semibold text-amber-300">
                <NumberTicker value={captain.bounty} className="text-amber-300" />
              </span>
              <span className="text-xs text-zinc-500">berries</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatBar
          label="Crew morale"
          value={captain.morale.current}
          max={captain.morale.max}
          from="#ef4444"
          to="#f97316"
        />
        <StatBar
          label="Berries pouch"
          value={captain.berries}
          max={Math.max(captain.berries + 1, 1000)}
          from="#38bdf8"
          to="#6366f1"
          showNumbers={false}
        />
      </div>
    </div>
  );
}
