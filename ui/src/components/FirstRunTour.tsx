"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const STORAGE_KEY = "logpose:firstRunDone";

type Step = {
  title: string;
  body: string;
  hint: string;
};

const STEPS: Step[] = [
  {
    title: "Bounty is your XP",
    body: "Every verified voyage adds to your Bounty (B). When it crosses a threshold you tier up: Rookie -> Supernova -> Warlord -> Yonko Commander -> Yonko -> Pirate King.",
    hint: "Berries are the separate soft currency that drops from voyages.",
  },
  {
    title: "Four Haki = your stats",
    body: "Buso (training, cold, cardio), Vitality (sleep, hydration, sun, meds, food), Kenbun (deep work, reading, learning), Haoshoku (mindfulness, anti-scroll, social).",
    hint: "Every cleared voyage bumps its Haki level by 1.",
  },
  {
    title: "Talk to the crew anytime",
    body: "Tap the Crew tab. Luffy hypes, Zoro trains, Nami navigates, Robin critiques, Chopper advises. They proactively chime in when you skip days or hit a milestone.",
    hint: "Use the Den Den Mushi for a group call when you want all five perspectives.",
  },
];

/**
 * Three-step coach-mark overlay shown exactly once on the very first visit.
 * Persists a flag in localStorage so it never reappears. Skippable at any
 * step. Pure overlay; doesn't change underlying page state.
 */
export function FirstRunTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        // Defer one frame so we don't paint over the very first content frame.
        const id = window.setTimeout(() => setOpen(true), 600);
        return () => window.clearTimeout(id);
      }
    } catch {
      // ignore - tour just won't show.
    }
  }, []);

  function finish() {
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  }

  function next() {
    if (step + 1 >= STEPS.length) {
      finish();
    } else {
      setStep((s) => s + 1);
    }
  }

  const current = STEPS[step];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={finish}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="first-run-title"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="surface m-4 w-full max-w-md overflow-hidden"
          >
            <div className="space-y-3 px-5 py-5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
                  Onboarding {step + 1} / {STEPS.length}
                </span>
                <button
                  onClick={finish}
                  className="text-[11px] font-medium uppercase tracking-widest text-zinc-500 hover:text-zinc-200"
                >
                  Skip
                </button>
              </div>
              <h2
                id="first-run-title"
                className="font-display text-xl font-semibold text-zinc-50"
              >
                {current.title}
              </h2>
              <p className="text-sm leading-relaxed text-zinc-300">
                {current.body}
              </p>
              <p className="text-[11px] italic text-zinc-500">{current.hint}</p>
              <div className="flex items-center justify-between pt-2">
                <div className="flex gap-1.5">
                  {STEPS.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-6 rounded-full transition ${
                        i <= step ? "bg-amber-400" : "bg-white/10"
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={next}
                  className="rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-zinc-900 hover:bg-amber-300"
                >
                  {step + 1 >= STEPS.length ? "Set sail" : "Next"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
