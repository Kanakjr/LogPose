"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Confetti, type ConfettiRef } from "@/components/magicui/confetti";
import { PixelPortrait } from "@/components/PixelPortrait";
import { NeonGradientCard } from "@/components/magicui/neon-gradient-card";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import type { Drop } from "@/lib/api";
import { spritePath, type SpriteKey } from "@/lib/sprites";

type Rarity = "common" | "rare" | "legendary" | "mythic";

function rarityFromKey(key?: string): Rarity {
  if (!key) return "common";
  if (key.startsWith("mythic")) return "mythic";
  if (key.startsWith("legendary")) return "legendary";
  if (key.startsWith("rare")) return "rare";
  return "common";
}

const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common drop",
  rare: "Rare drop",
  legendary: "Legendary drop",
  mythic: "Mythic drop",
};

const RARITY_COLOR: Record<Rarity, { from: string; to: string }> = {
  common: { from: "#94a3b8", to: "#64748b" },
  rare: { from: "#60a5fa", to: "#0ea5e9" },
  legendary: { from: "#a855f7", to: "#7c3aed" },
  mythic: { from: "#f59e0b", to: "#ec4899" },
};

function spriteForDrop(drop: Drop): SpriteKey {
  if (drop.kind === "berries_multiplier") return { kind: "chest", key: "gold" };
  const rarity = rarityFromKey(drop.rarity);
  if (rarity === "mythic") return { kind: "fruit", key: "gomu" };
  if (rarity === "legendary") return { kind: "chest", key: "gold" };
  if (rarity === "rare") return { kind: "chest", key: "silver" };
  return { kind: "chest", key: "wood" };
}

/**
 * Full-screen reward overlay shown when a voyage drops loot. Slides up,
 * fires confetti, displays the rarity + lore, then a button dismisses.
 */
export function DropReveal({
  drop,
  open,
  onClose,
}: {
  drop: Drop | null;
  open: boolean;
  onClose: () => void;
}) {
  const confettiRef = useRef<ConfettiRef>(null);

  useEffect(() => {
    if (open && drop && drop.kind !== "nothing") {
      confettiRef.current?.fire({
        particleCount: 90,
        spread: 80,
        startVelocity: 35,
        origin: { y: 0.55 },
      });
    }
  }, [open, drop]);

  if (!drop || drop.kind === "nothing") return null;

  const rarity =
    drop.kind === "item"
      ? rarityFromKey(drop.rarity)
      : ("mythic" as Rarity);
  const sprite = spriteForDrop(drop);
  const colors = RARITY_COLOR[rarity];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <Confetti
            ref={confettiRef}
            manualstart
            className="pointer-events-none absolute inset-0"
            style={{ width: "100%", height: "100%" }}
          />
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 60, scale: 0.9, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 60, scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
            className="relative w-full max-w-sm px-5 pb-6"
          >
            <NeonGradientCard
              borderRadius={28}
              neonColors={{ firstColor: colors.from, secondColor: colors.to }}
            >
              <div className="flex flex-col items-center gap-3 px-4 py-4 text-center">
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.3em]"
                  style={{ color: colors.from }}
                >
                  {RARITY_LABEL[rarity]}
                </span>
                <PixelPortrait
                  src={spritePath(sprite)}
                  size={120}
                  rounded="rounded-2xl"
                  idle
                />
                {drop.kind === "item" ? (
                  <>
                    <h2 className="font-display text-xl font-semibold text-zinc-50">
                      {drop.item_name}
                    </h2>
                    {drop.lore_text && (
                      <p className="px-2 text-xs italic text-zinc-400">
                        &ldquo;{drop.lore_text}&rdquo;
                      </p>
                    )}
                    {drop.haki_bonus && (
                      <span className="rounded-full bg-white/5 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-amber-300">
                        Awakens {drop.haki_bonus}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <h2 className="font-display text-xl font-semibold text-zinc-50">
                      {drop.berries_multiplier}x berries
                    </h2>
                    <p className="text-xs text-zinc-400">
                      Bonus +{drop.bonus_berries?.toLocaleString()} berries land in the pouch.
                    </p>
                  </>
                )}
                <ShimmerButton
                  onClick={onClose}
                  borderRadius="9999px"
                  className="mt-2 px-6 text-xs uppercase tracking-widest"
                >
                  Stow in chest
                </ShimmerButton>
              </div>
            </NeonGradientCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
