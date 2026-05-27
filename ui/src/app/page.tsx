"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { getCaptain, getMap, getVoyagesToday } from "@/lib/api";
import type { CaptainDTO, GrandLineDTO, VoyageDTO } from "@/lib/api";
import { CharacterHero } from "@/components/CharacterHero";
import { HakiRings } from "@/components/HakiRings";
import { VoyageGroups } from "@/components/VoyageGroups";
import { IslandStrip } from "@/components/IslandStrip";
import { NextUpCard } from "@/components/NextUpCard";
import { DailyRecap } from "@/components/DailyRecap";
import { AnimatedCircularProgressBar } from "@/components/magicui/animated-circular-progress-bar";

export default function HomePage() {
  const [captain, setCaptain] = useState<CaptainDTO | null>(null);
  const [voyages, setVoyages] = useState<VoyageDTO[]>([]);
  const [map, setMap] = useState<GrandLineDTO | null>(null);
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    // Captain + today are the critical path. Map is decorative; if it
    // 404s we still render the dashboard.
    Promise.all([getCaptain(), getVoyagesToday()])
      .then(([c, t]) => {
        if (!mounted) return;
        setCaptain(c);
        setVoyages(t.voyages);
        setDate(t.date);
      })
      .catch((e) => mounted && setErr(String(e)))
      .finally(() => mounted && setLoading(false));
    getMap()
      .then((m) => mounted && setMap(m))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  if (loading)
    return (
      <div className="space-y-4 lg:grid lg:grid-cols-12 lg:gap-6 lg:space-y-0">
        <div className="space-y-4 lg:col-span-5">
          <div className="surface h-44 animate-pulse" />
          <div className="surface h-14 animate-pulse" />
          <div className="surface h-20 animate-pulse" />
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="surface h-24 animate-pulse" />
            ))}
          </div>
        </div>
        <div className="space-y-3 lg:col-span-7">
          <div className="surface h-24 animate-pulse" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="surface h-14 animate-pulse"
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
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

  const nextUp = voyages.find((v) => !v.done_today) ?? null;

  const voyagesSection = (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="font-display text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Daily voyages
        </h2>
        <span className="font-mono text-[10px] text-zinc-500">
          {done}/{total} done
        </span>
      </div>
      <VoyageGroups voyages={voyages} hrefBase="/voyages" />
    </section>
  );

  return (
    <div className="space-y-5 lg:grid lg:grid-cols-12 lg:gap-6 lg:space-y-0">
      {/* Left rail on lg: identity + island + progress + Haki. Single
          column on mobile (everything stacks). */}
      <div className="space-y-4 lg:col-span-5 lg:sticky lg:top-20 lg:self-start">
        <CharacterHero captain={captain} />
        <IslandStrip map={map} />
        {progressCard}
        <HakiRings captain={captain} />
      </div>

      {/* Right rail on lg: Next-Up card on top, then the full voyage list. */}
      <div className="space-y-4 lg:col-span-7">
        {total > 0 && <NextUpCard voyage={nextUp} />}
        {voyagesSection}
      </div>

      {/* One-shot recap when the last voyage of the day is closed. Persists
          a per-date flag in localStorage so it only fires once. */}
      <DailyRecap date={date} voyages={voyages} />
    </div>
  );
}
