"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import { AnimatedCircularProgressBar } from "@/components/magicui/animated-circular-progress-bar";
import { ShimmerButton } from "@/components/magicui/shimmer-button";

type Stored = {
  voyageId: number;
  durationMs: number;
  // Either an absolute end-time (running) or a remaining-time (paused).
  endsAt: number | null;
  remainingMs: number | null;
};

type State =
  | { phase: "idle"; remainingMs: number }
  | { phase: "running"; endsAt: number; remainingMs: number }
  | { phase: "paused"; remainingMs: number };

const STORAGE_KEY = "logpose:timer";

function readStored(voyageId: number): Stored | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (parsed.voyageId !== voyageId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(s: Stored | null) {
  if (typeof window === "undefined") return;
  try {
    if (s == null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    }
  } catch {
    // localStorage may be unavailable; the timer still works in-memory.
  }
}

function fmt(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/**
 * Countdown for timer-mode voyages (Sanji's Brew 90 min, Drum Island 3 min,
 * Sunny Rest 20 min). Persists across refreshes via localStorage and tries
 * to acquire a Screen Wake Lock so the phone doesn't sleep mid-session.
 *
 * Calls `onComplete()` exactly once when the timer reaches 0, then the
 * caller is responsible for submitting the voyage attempt.
 */
export function TimerStage({
  voyageId,
  durationSec,
  title,
  onComplete,
  onAbort,
  accentColor = "#facc15",
  submitting = false,
}: {
  voyageId: number;
  durationSec: number;
  title: string;
  onComplete: () => void;
  onAbort?: () => void;
  accentColor?: string;
  submitting?: boolean;
}) {
  const durationMs = useMemo(() => Math.max(1, durationSec) * 1000, [durationSec]);
  const [state, setState] = useState<State>(() => {
    const stored = readStored(voyageId);
    if (stored) {
      if (stored.endsAt != null) {
        const remaining = stored.endsAt - Date.now();
        if (remaining > 0) {
          return { phase: "running", endsAt: stored.endsAt, remainingMs: remaining };
        }
      } else if (stored.remainingMs != null && stored.remainingMs > 0) {
        return { phase: "paused", remainingMs: stored.remainingMs };
      }
    }
    return { phase: "idle", remainingMs: durationMs };
  });
  const completedRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Persist on every state change so a refresh resumes cleanly.
  useEffect(() => {
    if (state.phase === "running") {
      writeStored({
        voyageId,
        durationMs,
        endsAt: state.endsAt,
        remainingMs: null,
      });
    } else if (state.phase === "paused") {
      writeStored({
        voyageId,
        durationMs,
        endsAt: null,
        remainingMs: state.remainingMs,
      });
    } else {
      writeStored(null);
    }
  }, [state, voyageId, durationMs]);

  // Tick once a second while running.
  useEffect(() => {
    if (state.phase !== "running") return;
    const id = window.setInterval(() => {
      setState((prev) => {
        if (prev.phase !== "running") return prev;
        const remaining = prev.endsAt - Date.now();
        if (remaining <= 0) {
          return { phase: "running", endsAt: prev.endsAt, remainingMs: 0 };
        }
        return { phase: "running", endsAt: prev.endsAt, remainingMs: remaining };
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [state.phase]);

  // Fire completion exactly once when remaining hits 0.
  useEffect(() => {
    if (
      state.phase === "running" &&
      state.remainingMs <= 0 &&
      !completedRef.current
    ) {
      completedRef.current = true;
      writeStored(null);
      onComplete();
    }
  }, [state, onComplete]);

  // Wake lock - keeps the screen awake for the duration of the session.
  const requestWakeLock = useCallback(async () => {
    try {
      const anyNav = navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
      };
      if (!anyNav.wakeLock) return;
      wakeLockRef.current = await anyNav.wakeLock.request("screen");
    } catch {
      // Not supported (older Safari etc.) - non-fatal.
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLockRef.current?.release();
    } catch {
      // ignore
    }
    wakeLockRef.current = null;
  }, []);

  useEffect(() => {
    if (state.phase === "running") {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
    return () => {
      releaseWakeLock();
    };
  }, [state.phase, requestWakeLock, releaseWakeLock]);

  function start() {
    setState((prev) => {
      const remaining = prev.phase === "idle" ? durationMs : prev.remainingMs;
      return {
        phase: "running",
        endsAt: Date.now() + remaining,
        remainingMs: remaining,
      };
    });
  }
  function pause() {
    setState((prev) =>
      prev.phase === "running"
        ? { phase: "paused", remainingMs: Math.max(0, prev.remainingMs) }
        : prev,
    );
  }
  function reset() {
    completedRef.current = false;
    setState({ phase: "idle", remainingMs: durationMs });
  }
  function abort() {
    completedRef.current = false;
    writeStored(null);
    setState({ phase: "idle", remainingMs: durationMs });
    onAbort?.();
  }

  const elapsedMs = durationMs - state.remainingMs;
  const pct = Math.max(0, Math.min(1, elapsedMs / durationMs));

  return (
    <div className="surface flex flex-col items-center gap-5 px-4 py-6 text-center">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
        Voyage timer
      </div>
      <div className="font-display text-base font-semibold text-zinc-100">
        {title}
      </div>

      <div className="relative">
        <AnimatedCircularProgressBar
          value={pct * 100}
          min={0}
          max={100}
          gaugePrimaryColor={accentColor}
          gaugeSecondaryColor="rgba(255,255,255,0.05)"
          showPercent={false}
          className="size-48"
        />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-mono text-4xl font-semibold tabular-nums"
            style={{ color: accentColor }}
          >
            {fmt(state.remainingMs)}
          </span>
          <span className="mt-1 text-[10px] uppercase tracking-widest text-zinc-500">
            {state.phase === "running"
              ? "running"
              : state.phase === "paused"
                ? "paused"
                : "ready"}
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {state.phase === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex w-full max-w-xs flex-col gap-2"
          >
            <ShimmerButton
              onClick={start}
              borderRadius="9999px"
              background={`linear-gradient(135deg, ${accentColor}, #f97316)`}
              shimmerColor="#fff5cc"
              className="text-xs uppercase tracking-widest"
            >
              <Play className="mr-1 inline-block h-3 w-3" />
              Start timer
            </ShimmerButton>
            <p className="text-[11px] text-zinc-500">
              The screen will stay awake. Phone face-down if that's the goal.
            </p>
          </motion.div>
        )}
        {state.phase === "running" && (
          <motion.div
            key="running"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex w-full max-w-xs gap-2"
          >
            <button
              onClick={pause}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/10 px-4 py-2.5 text-xs uppercase tracking-widest text-zinc-200 hover:bg-white/5"
            >
              <Pause className="h-3 w-3" />
              Pause
            </button>
            <button
              onClick={abort}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-rose-400/30 px-4 py-2.5 text-xs uppercase tracking-widest text-rose-200 hover:bg-rose-500/10"
            >
              <X className="h-3 w-3" />
              Abandon
            </button>
          </motion.div>
        )}
        {state.phase === "paused" && (
          <motion.div
            key="paused"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex w-full max-w-xs gap-2"
          >
            <button
              onClick={start}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-amber-400 px-4 py-2.5 text-xs uppercase tracking-widest text-zinc-900"
            >
              <Play className="h-3 w-3" />
              Resume
            </button>
            <button
              onClick={reset}
              className="flex items-center justify-center gap-1.5 rounded-full border border-white/10 px-4 py-2.5 text-xs uppercase tracking-widest text-zinc-200 hover:bg-white/5"
              aria-label="Reset"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {submitting && (
        <div className="text-[11px] text-zinc-400">Stamping the log...</div>
      )}
    </div>
  );
}
