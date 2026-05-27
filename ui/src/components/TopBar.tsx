"use client";

import Link from "next/link";
import { PixelPortrait } from "@/components/PixelPortrait";
import { ScrollProgress } from "@/components/magicui/scroll-progress";
import { spritePath } from "@/lib/sprites";

/**
 * Slim sticky top bar with a ScrollProgress accent. Pixel compass + brand on
 * the left; right slot is free for future controls (notifications, profile).
 */
export function TopBar() {
  return (
    <>
      <ScrollProgress />
      <header className="sticky top-0 z-30 border-b border-white/5 bg-zinc-950/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 lg:px-8">
          <Link
            href="/"
            className="group flex items-center gap-2"
            aria-label="LogPose home"
          >
            <PixelPortrait
              src={spritePath({ kind: "compass" })}
              size={28}
              rounded="rounded-md"
              alt="LogPose"
            />
            <span className="font-display text-base font-semibold tracking-tight text-zinc-100 group-hover:text-amber-300">
              LogPose
            </span>
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            set sail
          </span>
        </div>
      </header>
    </>
  );
}
