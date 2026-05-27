"use client";

import type { CaptainDTO } from "@/lib/api";
import { PixelPortrait } from "@/components/PixelPortrait";
import { StatBar } from "@/components/StatBar";
import { Term } from "@/components/Term";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { BorderBeam } from "@/components/magicui/border-beam";
import { captainTier, spritePath } from "@/lib/sprites";

/**
 * Habitica-style "hero" card: pixel portrait of the captain on the left, name
 * + tier + bounty on the right. Below: morale bar + a berries coin chip.
 *
 * Bounty is XP (raw integer, prefixed with the "B" sigil from the One Piece
 * wanted-poster bounty notation). Berries is the soft currency, shown as a
 * coin chip with a number - currency has no meaningful max, so we no longer
 * lie with a fake progress bar.
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
              <Term k="bounty">Bounty</Term>
            </div>
            <div className="flex items-baseline gap-1">
              <span aria-hidden className="font-mono text-lg font-semibold text-amber-400/80">
                B
              </span>
              <span className="font-mono text-2xl font-semibold text-amber-300">
                <NumberTicker
                  value={captain.bounty}
                  cacheKey="captain.bounty"
                  className="text-amber-300"
                />
              </span>
              <span className="ml-1 text-[10px] uppercase tracking-widest text-zinc-500">
                XP
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <StatBar
          label={<Term k="morale">Crew morale</Term>}
          value={captain.morale.current}
          max={captain.morale.max}
          from="#ef4444"
          to="#f97316"
        />
        <BerriesChip berries={captain.berries} />
      </div>
    </div>
  );
}

function BerriesChip({ berries }: { berries: number }) {
  return (
    <div
      className="flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/[0.06] px-3 py-1.5"
      title="Berries - the soft currency you earn from verified voyages"
    >
      <span
        aria-hidden
        className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-[10px] font-bold text-amber-950 shadow-[0_0_8px_rgba(250,204,21,0.4)]"
      >
        B
      </span>
      <span className="font-mono text-sm font-semibold text-amber-200">
        <NumberTicker
          value={berries}
          cacheKey="captain.berries"
          className="text-amber-200"
        />
      </span>
      <span className="text-[10px] uppercase tracking-widest text-zinc-500">
        <Term k="berries">Berries</Term>
      </span>
    </div>
  );
}
