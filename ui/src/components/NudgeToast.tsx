"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, X } from "lucide-react";
import { getNudges } from "@/lib/api";
import { PixelPortrait } from "@/components/PixelPortrait";
import { CREW_ACCENT, CREW_NAME, CREW_SPRITE } from "@/lib/sprites";

type Nudge = {
  crewmate: string;
  reason: string;
  content: string;
  ts: number;
};

const POLL_MS = 90_000;
// Once a nudge has been dismissed we don't want to re-show it for the rest
// of the day even though the server marked it delivered on first fetch.
// Tracked client-side to defend against race conditions.
const DISMISSED_KEY = "logpose:dismissed-nudges";

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function writeDismissed(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
  } catch {
    // ignore quota errors
  }
}

/**
 * Single-toast surface for proactive crew nudges. Polls /api/crew/nudges
 * while the tab is foregrounded and shows the first un-dismissed item
 * just below the TopBar. Tapping "Reply" hops to that crewmate's 1:1
 * chat thread.
 */
export function NudgeToast() {
  const router = useRouter();
  const [queue, setQueue] = useState<Nudge[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed());

  const refresh = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const r = await getNudges();
      if (r.nudges.length === 0) return;
      setQueue((prev) => {
        const seen = new Set(prev.map(idOf));
        const fresh = r.nudges.filter((n) => !seen.has(idOf(n)));
        if (fresh.length === 0) return prev;
        return [...prev, ...fresh];
      });
    } catch {
      // network blip; the next poll will try again
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, POLL_MS);
    const onVis = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  const active = queue.find((n) => !dismissed.has(idOf(n))) ?? null;

  function dismiss() {
    if (!active) return;
    const next = new Set(dismissed);
    next.add(idOf(active));
    setDismissed(next);
    writeDismissed(next);
  }

  function openThread() {
    if (!active) return;
    dismiss();
    router.push(`/crew?with=${encodeURIComponent(active.crewmate)}`);
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-12 z-40 flex justify-center px-3"
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence>
        {active && (
          <motion.div
            key={idOf(active)}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="pointer-events-auto w-full max-w-md"
          >
            <NudgeCard
              nudge={active}
              onDismiss={dismiss}
              onOpenThread={openThread}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NudgeCard({
  nudge,
  onDismiss,
  onOpenThread,
}: {
  nudge: Nudge;
  onDismiss: () => void;
  onOpenThread: () => void;
}) {
  const key = nudge.crewmate as keyof typeof CREW_SPRITE;
  const sprite = CREW_SPRITE[key];
  const accent = CREW_ACCENT[key] ?? "#facc15";
  const name = CREW_NAME[key] ?? nudge.crewmate;

  return (
    <div
      className="surface flex items-start gap-3 px-3 py-3 shadow-lg backdrop-blur"
      style={{ borderColor: `${accent}55` }}
    >
      {sprite && (
        <PixelPortrait
          src={sprite.chip}
          size={36}
          rounded="rounded-lg"
          alt={name}
          className="shrink-0"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: accent }}
          >
            {name}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            {nudge.reason.replace(/_/g, " ")}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-zinc-100">{nudge.content}</p>
        <button
          onClick={onOpenThread}
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-amber-200 hover:text-amber-100"
        >
          Reply
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function idOf(n: Nudge): string {
  return `${n.crewmate}:${n.ts}:${n.reason}`;
}
