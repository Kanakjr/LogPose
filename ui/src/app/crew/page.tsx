"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import { getCrew } from "@/lib/api";
import { CrewmateMeta } from "@/components/CrewPortrait";
import { CrewDock } from "@/components/CrewDock";
import { CrewChat } from "@/components/CrewChat";
import { SparklesText } from "@/components/magicui/sparkles-text";

type Mode = { kind: "group" } | { kind: "one"; crewmate: string };

export default function CrewPage() {
  return (
    // useSearchParams() needs a Suspense boundary in app-router. We wrap
    // the body in one so the page doesn't bail out of static rendering.
    <Suspense fallback={null}>
      <CrewPageInner />
    </Suspense>
  );
}

function CrewPageInner() {
  const searchParams = useSearchParams();
  const initialWith = searchParams.get("with");
  const [crew, setCrew] = useState<CrewmateMeta[]>([]);
  const [mode, setMode] = useState<Mode>(
    initialWith
      ? { kind: "one", crewmate: initialWith }
      : { kind: "group" },
  );

  useEffect(() => {
    getCrew()
      .then((r) => setCrew(r.crew))
      .catch(() => setCrew([]));
  }, []);

  // When the search param updates (e.g. a nudge reply on the same page),
  // re-target the chat without losing scroll state.
  useEffect(() => {
    if (initialWith) {
      setMode({ kind: "one", crewmate: initialWith });
    }
  }, [initialWith]);

  const threadKey = mode.kind === "group" ? "group" : mode.crewmate;

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
