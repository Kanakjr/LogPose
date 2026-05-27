"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type Props = {
  label: React.ReactNode;
  value: number;
  max: number;
  /** Gradient stops. */
  from: string;
  to: string;
  className?: string;
  /** Show numeric value next to label. */
  showNumbers?: boolean;
};

/**
 * Habitica-style horizontal stat bar with a gradient fill, label on the left,
 * and current/max numbers on the right.
 */
export function StatBar({
  label,
  value,
  max,
  from,
  to,
  className,
  showNumbers = true,
}: Props) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="font-medium uppercase tracking-wider text-zinc-400">
          {label}
        </span>
        {showNumbers && (
          <span className="font-mono text-zinc-200">
            {Math.round(value)}
            <span className="text-zinc-500">/{max}</span>
          </span>
        )}
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="absolute inset-y-0 left-0"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          style={{
            background: `linear-gradient(90deg, ${from}, ${to})`,
            boxShadow: `0 0 10px 0 ${to}55`,
          }}
        />
      </div>
    </div>
  );
}
