"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { getCaptain, getVoyagesToday } from "@/lib/api";
import type { CaptainDTO, VoyageDTO } from "@/lib/api";
import { CharacterHero } from "@/components/CharacterHero";
import { HakiRings } from "@/components/HakiRings";
import { VoyageRail } from "@/components/VoyageRail";
import { AnimatedList } from "@/components/magicui/animated-list";
import { AnimatedCircularProgressBar } from "@/components/magicui/animated-circular-progress-bar";

export default function HomePage() {
  const [captain, setCaptain] = useState<CaptainDTO | null>(null);
  const [voyages, setVoyages] = useState<VoyageDTO[]>([]);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([getCaptain(), getVoyagesToday()])
      .then(([c, t]) => {
        if (!mounted) return;
        setCaptain(c);
        setVoyages(t.voyages);
        setDate(t.date);
      })
      .catch((e) => mounted && setErr(String(e)))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  if (loading)
    return (
      <div className="mt-16 text-center text-sm text-zinc-500">
        Hoisting the sails...
      </div>
    );
  if (err)
    return (
      <div className="surface mt-6 px-4 py-3 text-sm text-rose-300">
        Couldn&apos;t reach the ship: {err}
      </div>
    );
  if (!captain) return null;

  const done = voyages.filter((v) => v.done_today).length;
  const total = voyages.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = total > 0 && done === total;

  const progressCard = (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="surface flex items-center gap-4 px-4 py-4"
    >
      <div className="relative shrink-0">
        <AnimatedCircularProgressBar
          value={done}
          min={0}
          max={Math.max(total, 1)}
          gaugePrimaryColor="#facc15"
          gaugeSecondaryColor="rgba(255,255,255,0.06)"
          showPercent={false}
          className="size-20"
        />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-base font-semibold text-zinc-100">
            {done}
            <span className="text-zinc-500">/{total}</span>
          </span>
          <span className="text-[9px] uppercase tracking-widest text-zinc-500">
            today
          </span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-zinc-100">
            Today&apos;s Log Pose
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            {date}
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
          {allDone
            ? "All voyages cleared. The compass locks on the next island."
            : `${pct}% of the way. Finish ${total - done} more to advance the Log Pose.`}
        </p>
      </div>
    </motion.div>
  );

  const voyagesSection = (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-display text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Daily voyages
        </h2>
        <span className="font-mono text-[10px] text-zinc-500">{total} open</span>
      </div>
      {total === 0 ? (
        <div className="surface px-4 py-6 text-center text-sm text-zinc-500">
          No voyages scheduled. Ask the crew on the Den Den Mushi.
        </div>
      ) : (
        <AnimatedList delay={80}>
          {voyages.map((v) => (
            <VoyageRail key={v.id} voyage={v} href={`/voyages/${v.id}`} />
          ))}
        </AnimatedList>
      )}
    </section>
  );

  return (
    <div className="space-y-5 lg:grid lg:grid-cols-12 lg:gap-6 lg:space-y-0">
      {/* Left rail on lg: identity + progress + Haki. Single column on mobile. */}
      <div className="space-y-5 lg:col-span-5 lg:sticky lg:top-20 lg:self-start">
        <CharacterHero captain={captain} />
        {progressCard}
        <HakiRings captain={captain} />
      </div>

      {/* Right rail on lg: today's voyages list. */}
      <div className="lg:col-span-7">{voyagesSection}</div>
    </div>
  );
}
