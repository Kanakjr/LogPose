"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Info } from "lucide-react";

const GLOSSARY: Record<string, { title: string; body: string }> = {
  bounty: {
    title: "Bounty (XP)",
    body: "Your reputation across the seas. Verified voyages add to Bounty. Crossing a threshold tiers you up: Rookie -> Supernova -> Warlord -> Yonko Commander -> Yonko -> Pirate King.",
  },
  berries: {
    title: "Berries",
    body: "The soft currency of the Grand Line. Drops from voyages and devil-fruit rolls. Future cosmetics and shop items will spend these.",
  },
  morale: {
    title: "Crew morale",
    body: "Your HP. Verified voyages tick +2. Missed dailies drain it overnight. Low morale means the crew gets cranky.",
  },
  haki: {
    title: "Haki",
    body: "Four stat pillars - Buso (training), Vitality (sleep / food / meds), Kenbun (focus / learning), Haoshoku (mindfulness / social). Each verified voyage bumps its affinity Haki by one level.",
  },
  buso: {
    title: "Buso Haki",
    body: "Armament Haki - covers physical training, cardio, cycling, cold exposure. Voyages tagged 'buso' earn it.",
  },
  vitality: {
    title: "Vitality Haki",
    body: "The body's baseline. Sleep, hydration, sunlight, thyroid meds, real food. The fastest Haki to lose if you skip the morning ritual.",
  },
  kenbun: {
    title: "Kenbun Haki",
    body: "Observation Haki - deep work, reading, language learning, anything that demands attention.",
  },
  haoshoku: {
    title: "Haoshoku Haki",
    body: "Conqueror's Haki - mindfulness, NSDR, anti-doom-scroll, social reach-outs. Trained by the things most people skip.",
  },
  marine_photo: {
    title: "Marine Verifier",
    body: "Optional. Snap a photo and Gemini Vision judges it against the voyage's verifier prompt. A clean verdict adds the evidence bonus on top of the base reward.",
  },
  self: {
    title: "Mark complete",
    body: "Tap when the deed is real. Always grants the base bounty + berries on the honor system. Add an optional photo for the evidence bonus.",
  },
  evidence_bonus: {
    title: "Evidence bonus",
    body: "Each voyage has a percentage bonus (typically 15-35%) added to bounty + berries when you attach a photo. The image is timestamped in Asia/Kolkata and stored for your future analytics dashboard.",
  },
};

type TermKey = keyof typeof GLOSSARY;

/**
 * Tap-to-explain glossary chip. Wrap any LogPose jargon to surface a quick
 * bottom-sheet definition. Uses native dialog semantics on click and stays
 * keyboard accessible.
 *
 * <Term k="bounty">Bounty</Term>
 */
export function Term({
  k,
  children,
  className = "",
}: {
  k: TermKey;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const entry = GLOSSARY[k];
  if (!entry) return <>{children}</>;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`What is ${entry.title}?`}
        className={
          "inline-flex items-baseline gap-0.5 underline decoration-dotted decoration-zinc-500 underline-offset-2 hover:decoration-amber-300 " +
          className
        }
      >
        {children}
        <Info aria-hidden className="h-2.5 w-2.5 translate-y-[-1px] text-zinc-500" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="surface m-4 w-full max-w-sm px-5 py-4"
            >
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
                Glossary
              </div>
              <h3 className="font-display mt-1 text-lg font-semibold text-zinc-50">
                {entry.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                {entry.body}
              </p>
              <div className="mt-4 text-right">
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-200 hover:bg-white/20"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
