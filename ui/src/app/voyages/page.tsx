"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { getVoyages } from "@/lib/api";
import type { VoyageDTO } from "@/lib/api";
import { VoyageRail } from "@/components/VoyageRail";
import { AnimatedList } from "@/components/magicui/animated-list";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  all: "All",
  straw_hat_ritual: "Rituals",
  crew_duty: "Crew duties",
  bounty_mission: "Bounties",
};

const CATEGORY_ORDER = ["all", "straw_hat_ritual", "crew_duty", "bounty_mission"];

export default function VoyagesPage() {
  const [voyages, setVoyages] = useState<VoyageDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("all");

  useEffect(() => {
    getVoyages()
      .then((r) => setVoyages(r.voyages))
      .finally(() => setLoading(false));
  }, []);

  const tabs = useMemo(() => {
    const counts: Record<string, number> = { all: voyages.length };
    for (const v of voyages) counts[v.category] = (counts[v.category] ?? 0) + 1;
    return CATEGORY_ORDER.filter((c) => c === "all" || counts[c]).map((c) => ({
      key: c,
      label: CATEGORY_LABELS[c] ?? c,
      count: counts[c] ?? 0,
    }));
  }, [voyages]);

  const visible = tab === "all" ? voyages : voyages.filter((v) => v.category === tab);

  if (loading)
    return (
      <div className="mt-16 text-center text-sm text-zinc-500">
        Loading voyages...
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <header className="px-1">
        <h1 className="font-display text-2xl font-semibold text-zinc-50">
          All voyages
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          Repeatable rituals, daily crew duties, and one-shot bounty missions.
        </p>
      </header>

      <div className="surface flex gap-1 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "relative flex-1 rounded-xl px-2 py-2 text-xs font-medium transition",
              tab === t.key
                ? "text-zinc-50"
                : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            {tab === t.key && (
              <motion.span
                layoutId="voyage-tab-pill"
                className="absolute inset-0 -z-10 rounded-xl bg-white/10"
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
              />
            )}
            {t.label}
            <span className="ml-1 font-mono text-[10px] text-zinc-500">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="surface px-4 py-10 text-center text-sm text-zinc-500">
          Nothing here yet. Ask the crew to suggest one.
        </div>
      ) : (
        <AnimatedList delay={60}>
          {visible.map((v) => (
            <VoyageRail key={v.id} voyage={v} href={`/voyages/${v.id}`} />
          ))}
        </AnimatedList>
      )}
    </div>
  );
}
