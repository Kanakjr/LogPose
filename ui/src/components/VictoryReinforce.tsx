"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Heart } from "lucide-react";
import { crewOneLiner } from "@/lib/api";
import type { AttemptResult, Haki, VoyageDTO } from "@/lib/api";
import { PixelPortrait } from "@/components/PixelPortrait";
import { CREW_ACCENT, CREW_NAME, CREW_SPRITE, HAKI_ACCENT, HAKI_LABEL } from "@/lib/sprites";

// Map Haki affinity -> crewmate who speaks the victory line.
const HAKI_TO_CREW: Record<Haki, keyof typeof CREW_SPRITE> = {
  vitality: "chopper",
  buso: "zoro",
  kenbun: "robin",
  haoshoku: "nami",
};

/**
 * Renders the after-glow of a verified voyage:
 *   - Morale bar animates +2.
 *   - Haki XP bump for the voyage's affinity stat.
 *   - One short line from the relevant crewmate (Chopper for vitality,
 *     Zoro for buso, Robin for kenbun, Nami for haoshoku).
 *
 * Designed to render below the ResultPanel verdict card, only on success.
 */
export function VictoryReinforce({
  voyage,
  result,
}: {
  voyage: VoyageDTO;
  result: AttemptResult;
}) {
  const crew = HAKI_TO_CREW[voyage.haki_affinity];
  const crewAccent = CREW_ACCENT[crew];
  const crewName = CREW_NAME[crew];
  const crewSprite = CREW_SPRITE[crew];
  const hakiColor = HAKI_ACCENT[voyage.haki_affinity];
  const hakiLabel = HAKI_LABEL[voyage.haki_affinity];

  const moraleMax = result.captain?.morale.max ?? 100;
  const moraleAfter = result.captain?.morale.current ?? moraleMax;
  // Morale ticks +2 per verified voyage; backend already applied it.
  const moraleBefore = Math.max(0, Math.min(moraleMax, moraleAfter - 2));
  const moralePctBefore = (moraleBefore / moraleMax) * 100;
  const moralePctAfter = (moraleAfter / moraleMax) * 100;

  const hakiAfter = result.captain?.haki[voyage.haki_affinity].level ?? 0;
  // Backend bumps the Haki level by 1 per successful voyage (see captain.py).
  const hakiBefore = Math.max(0, hakiAfter - 1);

  const [line, setLine] = useState<string | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    crewOneLiner(crew, "victory", { title: voyage.title })
      .then((r) => setLine(r.content))
      .catch(() => setLine(null));
  }, [crew, voyage.title]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="surface space-y-4 px-4 py-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DeltaBar
          label="Crew morale"
          icon={<Heart className="h-3 w-3" />}
          before={moralePctBefore}
          after={moralePctAfter}
          deltaText={`+${moraleAfter - moraleBefore}`}
          color="#fb7185"
        />
        <DeltaBar
          label={`${hakiLabel} Haki`}
          before={(hakiBefore / Math.max(hakiAfter + 1, 5)) * 100}
          after={(hakiAfter / Math.max(hakiAfter + 1, 5)) * 100}
          deltaText={`Lv ${hakiBefore} -> ${hakiAfter}`}
          color={hakiColor}
        />
      </div>

      <div className="flex items-start gap-3 border-t border-white/5 pt-3">
        {crewSprite && (
          <PixelPortrait
            src={crewSprite.chip}
            size={32}
            rounded="rounded-lg"
            alt={crewName}
            className="shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <div
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: crewAccent }}
          >
            {crewName}
          </div>
          <div className="mt-0.5 min-h-[1.25rem] text-sm text-zinc-100">
            {line ?? <SkeletonLine />}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function DeltaBar({
  label,
  icon,
  before,
  after,
  deltaText,
  color,
}: {
  label: string;
  icon?: React.ReactNode;
  before: number;
  after: number;
  deltaText: string;
  color: string;
}) {
  const pctBefore = Math.max(0, Math.min(100, before));
  const pctAfter = Math.max(0, Math.min(100, after));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest">
        <span className="flex items-center gap-1 text-zinc-400">
          {icon}
          {label}
        </span>
        <span className="font-mono font-semibold" style={{ color }}>
          {deltaText}
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          initial={{ width: `${pctBefore}%` }}
          animate={{ width: `${pctAfter}%` }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.25 }}
          style={{
            background: color,
            boxShadow: `0 0 10px 0 ${color}55`,
          }}
        />
      </div>
    </div>
  );
}

function SkeletonLine() {
  return (
    <span className="inline-flex gap-0.5 align-middle">
      <span
        className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-zinc-500"
        style={{ animationDelay: "0s" }}
      />
      <span
        className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-zinc-500"
        style={{ animationDelay: "0.15s" }}
      />
      <span
        className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-zinc-500"
        style={{ animationDelay: "0.3s" }}
      />
    </span>
  );
}
