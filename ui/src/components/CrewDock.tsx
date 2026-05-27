"use client";

import { motion } from "motion/react";
import { Phone } from "lucide-react";
import { PixelPortrait } from "@/components/PixelPortrait";
import { CREW_ACCENT, CREW_NAME, CREW_ROLE, CREW_SPRITE } from "@/lib/sprites";
import type { CrewmateMeta } from "@/components/CrewPortrait";
import { cn } from "@/lib/utils";

type Mode = { kind: "group" } | { kind: "one"; crewmate: string };

/**
 * Horizontal scroll-row of pixel crew portraits with a "Den Den Mushi" group
 * call tile in front. Selected item gets a colored ring + glow.
 */
export function CrewDock({
  crew,
  mode,
  onSelect,
  unread = {},
}: {
  crew: CrewmateMeta[];
  mode: Mode;
  onSelect: (mode: Mode) => void;
  unread?: Record<string, number>;
}) {
  return (
    <div className="-mx-2 overflow-x-auto px-2 pb-1">
      <div className="flex items-end gap-2">
        <CrewTile
          name="All crew"
          role="Den Den Mushi"
          accent="#facc15"
          active={mode.kind === "group"}
          unread={unread.group ?? 0}
          onClick={() => onSelect({ kind: "group" })}
        >
          <div
            className="flex h-[64px] w-[64px] items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/30 to-rose-500/20 ring-1 ring-amber-300/30"
            style={{ imageRendering: "pixelated" }}
          >
            <Phone className="h-7 w-7 text-amber-300" />
          </div>
        </CrewTile>
        {crew.map((c) => {
          const key = c.key as keyof typeof CREW_SPRITE;
          const sprite = CREW_SPRITE[key];
          const accent = CREW_ACCENT[key] ?? "#facc15";
          const isActive = mode.kind === "one" && mode.crewmate === c.key;
          return (
            <CrewTile
              key={c.key}
              name={CREW_NAME[key] ?? c.name}
              role={CREW_ROLE[key] ?? c.role}
              accent={accent}
              active={isActive}
              unread={unread[c.key] ?? 0}
              onClick={() => onSelect({ kind: "one", crewmate: c.key })}
            >
              <PixelPortrait
                src={sprite.full}
                size={64}
                ringColor={accent}
                active={isActive}
                idle={isActive}
                rounded="rounded-2xl"
                alt={c.name}
              />
            </CrewTile>
          );
        })}
      </div>
    </div>
  );
}

function CrewTile({
  children,
  name,
  role,
  accent,
  active,
  unread,
  onClick,
}: {
  children: React.ReactNode;
  name: string;
  role: string;
  accent: string;
  active: boolean;
  unread: number;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={cn(
        "relative flex shrink-0 flex-col items-center gap-1 rounded-2xl px-1.5 py-2 transition",
        active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]",
      )}
    >
      {children}
      <span className="text-[11px] font-semibold text-zinc-100">{name}</span>
      <span
        className="text-[9px] font-medium uppercase tracking-widest"
        style={{ color: active ? accent : "#71717a" }}
      >
        {role}
      </span>
      {unread > 0 && (
        <span className="absolute right-0 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold text-white">
          {unread}
        </span>
      )}
    </motion.button>
  );
}
