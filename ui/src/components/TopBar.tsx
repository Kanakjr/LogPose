"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Compass } from "lucide-react";
import { PixelPortrait } from "@/components/PixelPortrait";
import { ScrollProgress } from "@/components/magicui/scroll-progress";
import { spritePath } from "@/lib/sprites";
import { getVoyagesToday } from "@/lib/api";

/**
 * Slim sticky top bar with a ScrollProgress accent. Pixel compass + brand on
 * the left; right slot hosts the "Set sail" CTA which jumps the Captain to
 * the next undone voyage of the day (or the Crew page for a weekly review
 * if everything is already done).
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
          <SetSailCTA />
        </div>
      </header>
    </>
  );
}

function SetSailCTA() {
  const router = useRouter();
  const [target, setTarget] = useState<{
    href: string;
    label: string;
    allDone: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const t = await getVoyagesToday();
        if (cancelled) return;
        const next = t.voyages.find((v) => !v.done_today);
        if (next) {
          setTarget({ href: `/voyages/${next.id}`, label: "Set sail", allDone: false });
        } else if (t.voyages.length > 0) {
          setTarget({ href: "/crew", label: "Review", allDone: true });
        } else {
          setTarget({ href: "/voyages", label: "Set sail", allDone: false });
        }
      } catch {
        // Network/middleware error - render a generic fallback that still
        // routes somewhere useful.
        if (!cancelled) {
          setTarget({ href: "/voyages", label: "Set sail", allDone: false });
        }
      }
    }
    refresh();
    return () => {
      cancelled = true;
    };
  }, []);

  function onClick() {
    if (target) router.push(target.href);
  }

  return (
    <button
      onClick={onClick}
      disabled={!target}
      aria-label={
        target?.allDone
          ? "All voyages done - open the crew for a weekly review"
          : "Jump to the next voyage"
      }
      className="group flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-400/[0.06] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-200 transition hover:border-amber-300/40 hover:bg-amber-400/[0.12] disabled:opacity-40"
    >
      <Compass className="h-3 w-3 transition group-hover:rotate-90" />
      {target?.label ?? "set sail"}
    </button>
  );
}
