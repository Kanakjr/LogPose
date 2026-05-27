"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Camera, CheckCircle2, Clock, Wind, Flame } from "lucide-react";
import type { VoyageDTO } from "@/lib/api";
import { PixelPortrait } from "@/components/PixelPortrait";
import { spritePath, voyageIcon, HAKI_ACCENT } from "@/lib/sprites";
import { cn } from "@/lib/utils";

const VERIFICATION_ICON = {
  marine_photo: Camera,
  self: CheckCircle2,
  timer: Clock,
  stillness: Wind,
} as const;

/**
 * Horizontal row card representing a single voyage. Habitica habit-row vibe:
 * small pixel icon on the left, title + reward chips in the middle, verifier
 * icon on the right, plus a completion checkmark if done today.
 */
export function VoyageRail({
  voyage,
  href,
}: {
  voyage: VoyageDTO;
  href?: string;
}) {
  const done = !!voyage.done_today;
  const streak = voyage.streak?.current ?? 0;
  const VerifyIcon =
    VERIFICATION_ICON[voyage.verification_mode] ?? CheckCircle2;
  const haki = HAKI_ACCENT[voyage.haki_affinity];
  const icon = voyageIcon(voyage);

  const body = (
    <motion.div
      whileTap={{ scale: 0.98 }}
      whileHover={{ y: -1 }}
      className={cn(
        "group relative flex items-center gap-3 rounded-2xl border bg-zinc-900/60 px-3 py-2.5 backdrop-blur transition",
        done
          ? "border-amber-400/40 bg-amber-400/[0.06]"
          : "border-white/10 hover:border-white/20",
      )}
    >
      <span
        className="absolute left-0 top-2 bottom-2 w-1 rounded-full"
        style={{ background: haki, opacity: done ? 0.45 : 0.85 }}
      />
      <PixelPortrait
        src={spritePath(icon)}
        size={48}
        alt=""
        rounded="rounded-xl"
        className="ml-1 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3
            className={cn(
              "font-display truncate text-[15px] font-semibold",
              done ? "text-zinc-400 line-through decoration-zinc-600" : "text-zinc-100",
            )}
          >
            {voyage.title}
          </h3>
          {streak > 0 && (
            <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-300">
              <Flame className="h-2.5 w-2.5" />
              {streak}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
          <span className="font-mono text-amber-300/80">
            +{voyage.base_bounty.toLocaleString()}
          </span>
          <span>·</span>
          <span className="font-mono text-sky-300/80">
            +{voyage.base_berries}
          </span>
          <span>·</span>
          <span className="capitalize" style={{ color: haki }}>
            {voyage.haki_affinity}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-amber-400" />
        ) : (
          <VerifyIcon className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300" />
        )}
      </div>
    </motion.div>
  );

  if (!href) return body;
  return (
    <Link href={href} className="block">
      {body}
    </Link>
  );
}
