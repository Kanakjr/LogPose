"use client";

import { useEffect, useMemo, useRef, type ComponentPropsWithoutRef } from "react";
import { useInView, useMotionValue, useSpring } from "motion/react";

import { cn } from "@/lib/utils";

interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  value: number;
  startValue?: number;
  direction?: "up" | "down";
  delay?: number;
  decimalPlaces?: number;
  /**
   * If set, the previous value is cached in sessionStorage under this key
   * so the ticker only re-animates when the delta from the cached value
   * exceeds ~5% (or 1 unit, whichever is larger). Use this for values
   * that don't change every page-load (e.g. a Captain's bounty) so the
   * count-up doesn't replay on every nav-back.
   */
  cacheKey?: string;
}

function readCachedValue(key: string | undefined): number | null {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`nt:${key}`);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeCachedValue(key: string | undefined, value: number) {
  if (!key || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(`nt:${key}`, String(value));
  } catch {
    // sessionStorage may be unavailable (private browsing on Safari, etc.)
  }
}

export function NumberTicker({
  value,
  startValue = 0,
  direction = "up",
  delay = 0,
  className,
  decimalPlaces = 0,
  cacheKey,
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);

  // Decide the effective start value: if the cached value is "close enough"
  // we start at `value` directly, which makes the spring a no-op and the
  // number renders instantly without the eye-catching count-up.
  const effectiveStart = useMemo(() => {
    const cached = readCachedValue(cacheKey);
    if (cached == null) return startValue;
    const delta = Math.abs(value - cached);
    const threshold = Math.max(1, Math.abs(value) * 0.05);
    return delta <= threshold ? value : cached;
  }, [cacheKey, value, startValue]);

  const motionValue = useMotionValue(
    direction === "down" ? value : effectiveStart,
  );
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
  });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (isInView) {
      timer = setTimeout(() => {
        motionValue.set(direction === "down" ? effectiveStart : value);
        writeCachedValue(cacheKey, value);
      }, delay * 1000);
    }
    return () => {
      if (timer !== null) clearTimeout(timer);
    };
  }, [motionValue, isInView, delay, value, direction, effectiveStart, cacheKey]);

  useEffect(
    () =>
      springValue.on("change", (latest) => {
        if (ref.current) {
          ref.current.textContent = Intl.NumberFormat("en-US", {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces,
          }).format(Number(latest.toFixed(decimalPlaces)));
        }
      }),
    [springValue, decimalPlaces],
  );

  return (
    <span
      ref={ref}
      className={cn("inline-block tabular-nums", className)}
      {...props}
    >
      {effectiveStart}
    </span>
  );
}
