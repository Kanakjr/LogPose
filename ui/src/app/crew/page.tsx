"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { getCrew, getNudges } from "@/lib/api";
import { CrewmateMeta } from "@/components/CrewPortrait";
import { CrewDock } from "@/components/CrewDock";
import { CrewChat } from "@/components/CrewChat";
import { SparklesText } from "@/components/magicui/sparkles-text";
import { CREW_ACCENT, CREW_NAME } from "@/lib/sprites";

type Mode = { kind: "group" } | { kind: "one"; crewmate: string };
type Nudge = { crewmate: string; content: string; ts: number };

export default function CrewPage() {
  const [crew, setCrew] = useState<CrewmateMeta[]>([]);
  const [mode, setMode] = useState<Mode>({ kind: "group" });
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getCrew()
      .then((r) => setCrew(r.crew))
      .catch(() => setCrew([]));
    getNudges()
      .then((r) => setNudges(r.nudges))
      .catch(() => setNudges([]));
  }, []);

  const threadKey = mode.kind === "group" ? "group" : mode.crewmate;
  const visibleNudges = nudges.filter((_, i) => !dismissed[String(i)]);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="px-1">
        <h1 className="font-display text-2xl font-semibold text-zinc-50">
          <SparklesText
            sparklesCount={6}
            colors={{ first: "#facc15", second: "#fb7185" }}
          >
            Crew quarters
          </SparklesText>
        </h1>
        <p className="mt-1 text-xs text-zinc-500">
          Five voices on the Sunny. Tap one to talk privately, or call all of
          them on the Den Den Mushi.
        </p>
      </div>

      {visibleNudges.length > 0 && (
        <div className="space-y-2">
          {visibleNudges.map((n, i) => {
            const key = n.crewmate as keyof typeof CREW_ACCENT;
            const accent = CREW_ACCENT[key] ?? "#facc15";
            const name = CREW_NAME[key] ?? n.crewmate;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="surface relative flex items-start gap-3 px-4 py-3"
                style={{ borderLeft: `2px solid ${accent}` }}
              >
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: accent }}
                  >
                    {name}
                  </div>
                  <div className="mt-0.5 text-sm text-zinc-200">{n.content}</div>
                </div>
                <button
                  onClick={() =>
                    setDismissed((d) => ({ ...d, [String(i)]: true }))
                  }
                  className="shrink-0 rounded-full p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
                  aria-label="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="surface px-2 py-3">
        <CrewDock crew={crew} mode={mode} onSelect={setMode} />
      </div>

      <motion.div
        key={threadKey}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="surface flex h-[62vh] flex-col overflow-hidden lg:h-[72vh]"
      >
        <CrewChat
          crewmate={mode.kind === "one" ? mode.crewmate : undefined}
          threadKey={threadKey}
          groupMode={mode.kind === "group"}
        />
      </motion.div>
    </div>
  );
}
