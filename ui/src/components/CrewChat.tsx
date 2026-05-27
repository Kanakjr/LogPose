"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp } from "lucide-react";
import { getCrewHistory, streamCrewChat } from "@/lib/api";
import { ChatBubble } from "@/components/ChatBubble";
import { Ripple } from "@/components/magicui/ripple";
import { CREW_NAME, HAKI_ACCENT, HAKI_LABEL } from "@/lib/sprites";

// Starter prompts shown only when a thread is empty. Group thread gets
// review-flavoured openers; 1-on-1 threads get persona-tailored ones.
const GROUP_STARTERS = [
  "How am I doing?",
  "Pick my next voyage",
  "Coach me through the day",
  "What did I skip yesterday?",
];

const ONE_ON_ONE_STARTERS: Record<string, string[]> = {
  luffy: ["I need a push", "Hype me for today", "Why does this matter?"],
  zoro: ["Plan a Buso workout", "I skipped Zone 2 - what now?", "Cold plunge today?"],
  nami: ["Plan my week", "Where am I drifting?", "Suggest a new voyage"],
  robin: ["Be honest about my excuses", "Critique yesterday", "What pattern am I missing?"],
  chopper: ["Did I take Thyronorm?", "Sleep advice", "How's my heart-health risk?"],
};

// Mid-conversation quick replies. Shown above the input once at least one
// crew reply has landed, so the user always has a fast follow-up.
const QUICK_REPLIES_GROUP = [
  "Plan my morning",
  "Suggest a voyage",
  "Why didn't I do that?",
];

const QUICK_REPLIES_ONE: Record<string, string[]> = {
  luffy: ["Push me harder", "I'm done for today"],
  zoro: ["Schedule it", "Make it simpler"],
  nami: ["Suggest a voyage", "Where am I weak?"],
  robin: ["Be more direct", "What's the pattern?"],
  chopper: ["Tomorrow's plan", "How worried should I be?"],
};

type Bubble = {
  agent: string;
  content: string;
  id: string;
  streaming?: boolean;
};

type Action = { name: string; payload: string };

/**
 * iMessage-style group chat panel. Streams crew responses, renders each turn
 * as a ChatBubble, and surfaces structured agent actions as inline chips at
 * the bottom of the conversation.
 */
export function CrewChat({
  crewmate,
  threadKey,
  groupMode,
}: {
  crewmate?: string;
  threadKey: string;
  groupMode?: boolean;
}) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    setBubbles([]);
    setActions([]);
    getCrewHistory(threadKey).then((r) => {
      if (!mounted) return;
      const initial: Bubble[] = r.history.map((h, i) => ({
        agent: h.role === "user" ? "user" : h.crewmate ?? "luffy",
        content: h.content,
        id: `init-${i}`,
      }));
      setBubbles(initial);
      requestAnimationFrame(scrollToEnd);
    });
    return () => {
      mounted = false;
    };
  }, [threadKey]);

  function scrollToEnd() {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }

  function send() {
    sendWith(draft.trim());
  }

  const placeholder = groupMode
    ? "Den Den Mushi - the crew may chime in..."
    : `Message ${CREW_NAME[crewmate as keyof typeof CREW_NAME] ?? "the crew"}...`;

  // Collapse the avatar+name header when consecutive bubbles share an agent.
  const display = bubbles.map((b, i) => {
    const prev = bubbles[i - 1];
    return { ...b, showHeader: !prev || prev.agent !== b.agent };
  });

  const starters = groupMode
    ? GROUP_STARTERS
    : ONE_ON_ONE_STARTERS[crewmate ?? ""] ?? GROUP_STARTERS;

  function sendStarter(text: string) {
    setDraft(text);
    // Defer so setDraft commits before send() trims the draft state.
    requestAnimationFrame(() => {
      sendWith(text);
    });
  }

  async function sendWith(text: string) {
    if (!text.trim() || sending) return;
    setDraft("");
    setSending(true);
    setActions([]);

    const userId = `u-${Date.now()}`;
    setBubbles((prev) => [...prev, { agent: "user", content: text, id: userId }]);
    requestAnimationFrame(scrollToEnd);

    const partials: Record<string, string> = {};
    const startedIds: Record<string, string> = {};

    try {
      for await (const ev of streamCrewChat({
        crewmate,
        message: text,
        thread_key: threadKey,
      })) {
        if (ev.event === "agent_start") {
          const agent = String(ev.data.agent);
          const id = `${agent}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          startedIds[agent] = id;
          partials[agent] = "";
          setBubbles((prev) => [
            ...prev,
            { agent, content: "", id, streaming: true },
          ]);
          requestAnimationFrame(scrollToEnd);
        } else if (ev.event === "token") {
          const agent = String(ev.data.agent);
          const t = String(ev.data.text || "");
          partials[agent] = (partials[agent] ?? "") + t;
          const id = startedIds[agent];
          if (id) {
            setBubbles((prev) =>
              prev.map((b) =>
                b.id === id ? { ...b, content: partials[agent] } : b,
              ),
            );
            requestAnimationFrame(scrollToEnd);
          }
        } else if (ev.event === "action") {
          setActions((a) => [
            ...a,
            { name: String(ev.data.name), payload: String(ev.data.payload) },
          ]);
        } else if (ev.event === "agent_end") {
          const agent = String(ev.data.agent);
          const id = startedIds[agent];
          if (id) {
            setBubbles((prev) =>
              prev.map((b) => (b.id === id ? { ...b, streaming: false } : b)),
            );
          }
        }
      }
    } catch (e) {
      setBubbles((prev) => [
        ...prev,
        {
          agent: "luffy",
          content: `(transmission failed: ${String(e)})`,
          id: `err-${Date.now()}`,
        },
      ]);
    } finally {
      setSending(false);
      setBubbles((prev) => prev.map((b) => ({ ...b, streaming: false })));
      requestAnimationFrame(scrollToEnd);
    }
  }

  return (
    <div className="relative flex h-full flex-col">
      {/* Ripple only fires while a stream is in flight, not on idle empty
          threads. The previous behaviour looked like a stuck loader. */}
      {sending && bubbles.filter((b) => b.agent !== "user").length === 0 && (
        <Ripple className="-mt-12" mainCircleSize={120} numCircles={5} />
      )}
      <div
        ref={scrollRef}
        className="flex-1 space-y-2 overflow-y-auto px-2 py-3"
      >
        {display.length === 0 && !sending && (
          <CrewEmptyState
            starters={starters}
            onPick={sendStarter}
            label={
              groupMode
                ? "Call the whole crew"
                : `Talk to ${CREW_NAME[crewmate as keyof typeof CREW_NAME] ?? "the crew"}`
            }
          />
        )}
        <AnimatePresence initial={false}>
          {display.map((b) => (
            <motion.div
              key={b.id}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <ChatBubble
                agent={b.agent}
                content={b.content}
                streaming={!!b.streaming}
                showHeader={b.showHeader}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        {actions.length > 0 && (
          <div className="space-y-2 pt-2">
            {actions.map((a, i) => (
              <ActionChip key={i} action={a} />
            ))}
          </div>
        )}
      </div>
      {/* Quick replies: only appear after at least one crew turn has been
          rendered so they don't compete with the starter-chip empty state. */}
      {display.some((b) => b.agent !== "user") && !sending && (
        <div className="flex flex-wrap gap-1.5 border-t border-white/5 bg-zinc-950/60 px-2 py-2 backdrop-blur">
          {(groupMode
            ? QUICK_REPLIES_GROUP
            : QUICK_REPLIES_ONE[crewmate ?? ""] ?? QUICK_REPLIES_GROUP
          ).map((q) => (
            <button
              key={q}
              onClick={() => sendWith(q)}
              className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-300 transition hover:border-amber-300/40 hover:bg-amber-400/[0.08] hover:text-amber-100"
            >
              {q}
            </button>
          ))}
        </div>
      )}
      <div className="sticky bottom-0 flex items-end gap-2 border-t border-white/5 bg-zinc-950/80 px-2 py-2 backdrop-blur">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={placeholder}
          className="min-h-[40px] flex-1 resize-none rounded-2xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-300/40 focus:outline-none"
          rows={1}
        />
        <button
          onClick={send}
          disabled={sending || !draft.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-zinc-900 transition disabled:opacity-30"
          aria-label="Send"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CrewEmptyState({
  starters,
  onPick,
  label,
}: {
  starters: string[];
  onPick: (text: string) => void;
  label: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex max-w-md flex-col items-center gap-3 pt-10 text-center"
    >
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </div>
      <div className="text-sm text-zinc-300">
        Try one of these to break the ice.
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {starters.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-200 transition hover:border-amber-300/40 hover:bg-amber-400/[0.08] hover:text-amber-200"
          >
            {s}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function ActionChip({ action }: { action: Action }) {
  let parsed: Record<string, unknown> | null = null;
  if (action.name === "voyage_create") {
    try {
      parsed = JSON.parse(action.payload);
    } catch {
      parsed = null;
    }
  }
  if (action.name === "voyage_create" && parsed) {
    const accent = HAKI_ACCENT[String(parsed.haki_affinity ?? "")] ?? "#facc15";
    return (
      <VoyageProposalCard parsed={parsed} accent={accent} />
    );
  }
  if (action.name === "suggest_focus") {
    const haki = action.payload.trim().toLowerCase();
    const accent = HAKI_ACCENT[haki] ?? "#38bdf8";
    const label = HAKI_LABEL[haki] ?? haki;
    return (
      <div
        className="surface ml-9 flex items-center gap-3 px-4 py-3"
        style={{ borderLeft: `2px solid ${accent}` }}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold uppercase"
          style={{ background: `${accent}22`, color: accent }}
        >
          {label.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-sky-300">
            Navigator&apos;s focus
          </div>
          <div className="text-sm text-zinc-200">
            Lean into{" "}
            <span className="font-semibold" style={{ color: accent }}>
              {label}
            </span>{" "}
            this week.
          </div>
        </div>
      </div>
    );
  }
  return null;
}

function VoyageProposalCard({
  parsed,
  accent,
}: {
  parsed: Record<string, unknown>;
  accent: string;
}) {
  const [state, setState] = useState<"idle" | "saving" | "added" | "error">("idle");

  async function add() {
    setState("saving");
    try {
      const r = await fetch("/api/game/voyages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildVoyageBody(parsed)),
      });
      setState(r.ok ? "added" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="surface ml-9 overflow-hidden"
      style={{ borderLeft: `2px solid ${accent}` }}
    >
      <div className="px-4 py-3">
        <div
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: accent }}
        >
          Proposed voyage
        </div>
        <div className="font-display mt-1 text-base text-zinc-100">
          {String(parsed.title ?? "Untitled")}
        </div>
        {parsed.description ? (
          <p className="mt-1 text-xs text-zinc-400">
            {String(parsed.description)}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
          {parsed.haki_affinity ? (
            <span style={{ color: accent }}>
              {HAKI_LABEL[String(parsed.haki_affinity)] ?? String(parsed.haki_affinity)}
            </span>
          ) : null}
          {parsed.base_bounty ? (
            <span>+B {Number(parsed.base_bounty).toLocaleString()}</span>
          ) : null}
          {parsed.base_berries ? (
            <span>+{Number(parsed.base_berries)} berries</span>
          ) : null}
          {parsed.recurrence ? <span>{String(parsed.recurrence)}</span> : null}
        </div>
        <button
          onClick={add}
          disabled={state === "saving" || state === "added"}
          className="mt-3 rounded-full bg-amber-400 px-3 py-1.5 text-[10px] uppercase tracking-widest text-zinc-900 transition disabled:opacity-50"
        >
          {state === "added"
            ? "Added"
            : state === "saving"
              ? "Adding..."
              : state === "error"
                ? "Retry"
                : "Add to voyages"}
        </button>
      </div>
    </motion.div>
  );
}

function buildVoyageBody(parsed: Record<string, unknown>) {
  return {
    title: String(parsed.title ?? "New Voyage"),
    description: String(parsed.description ?? ""),
    haki_affinity: String(parsed.haki_affinity ?? "vitality"),
    base_bounty: Number(parsed.base_bounty ?? 100000),
    base_berries: Number(parsed.base_berries ?? 25),
    verification_mode: String(parsed.verification_mode ?? "self"),
    recurrence: String(parsed.recurrence ?? "one_shot"),
    cooldown_sec: Number(parsed.cooldown_sec ?? 0),
    category: String(parsed.category ?? "bounty_mission"),
    verifier_prompt: parsed.verifier_prompt
      ? String(parsed.verifier_prompt)
      : null,
    icon: parsed.icon ? String(parsed.icon) : null,
    theme_keyword: parsed.theme_keyword ? String(parsed.theme_keyword) : null,
    active: true,
  };
}

