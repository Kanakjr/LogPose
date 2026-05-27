"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt?: string;
  /** Pixel size of the rendered tile. */
  size?: number;
  /** Optional ring color around the portrait (e.g. crew accent). */
  ringColor?: string;
  /** Glow when active/selected. */
  active?: boolean;
  /** Make the tile float gently like an idle sprite. */
  idle?: boolean;
  /** Extra rounding for the tile background. */
  rounded?: string;
  className?: string;
};

/**
 * PixelPortrait renders a sprite with the chunky pixel-art aesthetic of the
 * source assets. It uses `image-rendering: pixelated` so PNGs stay crisp at
 * any size.
 */
export function PixelPortrait({
  src,
  alt = "",
  size = 80,
  ringColor,
  active = false,
  idle = false,
  rounded = "rounded-2xl",
  className,
}: Props) {
  return (
    <motion.div
      animate={idle ? { y: [0, -2, 0] } : undefined}
      transition={
        idle ? { duration: 3.2, repeat: Infinity, ease: "easeInOut" } : undefined
      }
      style={{
        width: size,
        height: size,
        boxShadow: active
          ? `0 0 24px 0 ${ringColor ?? "#facc15"}55, inset 0 0 0 2px ${ringColor ?? "#facc15"}`
          : ringColor
            ? `inset 0 0 0 2px ${ringColor}55`
            : undefined,
      }}
      className={cn(
        "relative overflow-hidden bg-zinc-900",
        rounded,
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="block h-full w-full object-cover"
        style={{ imageRendering: "pixelated" }}
      />
    </motion.div>
  );
}
