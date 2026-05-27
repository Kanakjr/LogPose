"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { getTreasure } from "@/lib/api";
import type { TreasureGroup } from "@/lib/api";
import { MagicCard } from "@/components/magicui/magic-card";
import { NeonGradientCard } from "@/components/magicui/neon-gradient-card";
import { PixelPortrait } from "@/components/PixelPortrait";
import { spritePath } from "@/lib/sprites";

function rarityClass(r: string): "mythic" | "legendary" | "rare" | "common" {
  if (r.startsWith("mythic")) return "mythic";
  if (r.startsWith("legendary")) return "legendary";
  if (r.startsWith("rare")) return "rare";
  return "common";
}

const RARITY_COLOR: Record<string, string> = {
  common: "#94a3b8",
  rare: "#60a5fa",
  legendary: "#a855f7",
  mythic: "#f59e0b",
};

const RARITY_LABEL: Record<string, string> = {
  common: "Common",
  rare: "Rare",
  legendary: "Legendary",
  mythic: "Mythic",
};

function spriteForGroup(rarity: string) {
  const r = rarityClass(rarity);
  if (r === "mythic") return spritePath({ kind: "fruit", key: "gomu" });
  if (r === "legendary") return spritePath({ kind: "chest", key: "gold" });
  if (r === "rare") return spritePath({ kind: "chest", key: "silver" });
  return spritePath({ kind: "chest", key: "wood" });
}

export default function TreasurePage() {
  const [groups, setGroups] = useState<TreasureGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTreasure()
      .then((r) => {
        setGroups(r.groups);
        setTotal(r.total);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="mt-16 text-center text-sm text-zinc-500">
        Opening the chest...
      </div>
    );

  const mythics = groups.find((g) => rarityClass(g.rarity) === "mythic")?.items ?? [];
  const others = groups.filter((g) => rarityClass(g.rarity) !== "mythic");

  return (
    <div className="space-y-6">
      <header className="px-1">
        <h1 className="font-display text-2xl font-semibold text-zinc-50">
          Treasure chest
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          {total} item{total === 1 ? "" : "s"} salvaged from finished voyages.
        </p>
      </header>

      {total === 0 && (
        <div className="surface px-4 py-10 text-center">
          <div className="mx-auto mb-3 flex w-fit">
            <PixelPortrait
              src={spritePath({ kind: "chest", key: "wood" })}
              size={88}
              rounded="rounded-2xl"
              alt="Empty wooden chest"
              idle
            />
          </div>
          <div className="font-display text-sm text-zinc-200">
            The chest sits empty.
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            Verified voyages drop loot. Devil Fruits hide in here too.
          </div>
          <Link
            href="/"
            className="mt-4 inline-flex items-center gap-1 rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-zinc-900 transition hover:bg-amber-300"
          >
            Set sail
          </Link>
        </div>
      )}

      {mythics.length > 0 && (
        <section className="space-y-3">
          <SectionHeader rarity="mythic" count={mythics.length} />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {mythics.map((it) => (
              <NeonGradientCard
                key={it.id}
                borderRadius={22}
                neonColors={{ firstColor: "#f59e0b", secondColor: "#ec4899" }}
              >
                <div className="flex items-start gap-3 px-2 py-1">
                  <PixelPortrait
                    src={spritePath({ kind: "fruit", key: "gomu" })}
                    size={56}
                    rounded="rounded-xl"
                    alt=""
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-base font-semibold text-zinc-50">
                      {it.item_name}
                    </div>
                    {it.lore_text && (
                      <p className="mt-1 text-xs italic text-zinc-300">
                        &ldquo;{it.lore_text}&rdquo;
                      </p>
                    )}
                    {it.haki_bonus && (
                      <span className="mt-2 inline-block rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] uppercase tracking-widest text-amber-200">
                        Awakens {it.haki_bonus}
                      </span>
                    )}
                  </div>
                </div>
              </NeonGradientCard>
            ))}
          </div>
        </section>
      )}

      {others.map((g) => {
        if (g.items.length === 0) return null;
        const sprite = spriteForGroup(g.rarity);
        const r = rarityClass(g.rarity);
        const color = RARITY_COLOR[r];
        return (
          <section key={g.rarity} className="space-y-3">
            <SectionHeader rarity={r} count={g.items.length} />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {g.items.map((it) => (
                <MagicCard
                  key={it.id}
                  gradientFrom={color}
                  gradientTo={color}
                  className="p-3"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-3"
                  >
                    <PixelPortrait src={sprite} size={48} rounded="rounded-xl" alt="" />
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-sm font-semibold text-zinc-100">
                        {it.item_name}
                      </div>
                      {it.lore_text && (
                        <p className="mt-1 line-clamp-2 text-[11px] italic text-zinc-400">
                          &ldquo;{it.lore_text}&rdquo;
                        </p>
                      )}
                      {it.haki_bonus && (
                        <span
                          className="mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest"
                          style={{ background: `${color}22`, color }}
                        >
                          {it.haki_bonus}
                        </span>
                      )}
                    </div>
                  </motion.div>
                </MagicCard>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SectionHeader({ rarity, count }: { rarity: string; count: number }) {
  const color = RARITY_COLOR[rarity];
  return (
    <div className="flex items-baseline justify-between px-1">
      <h2
        className="text-[11px] font-semibold uppercase tracking-widest"
        style={{ color }}
      >
        {RARITY_LABEL[rarity]} loot
      </h2>
      <span className="font-mono text-[10px] text-zinc-500">{count}</span>
    </div>
  );
}
