"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp } from "lucide-react";
import { getCrewHistory, streamCrewChat } from "@/lib/api";
import { ChatBubble } from "@/components/ChatBubble";
import { Ripple } from "@/components/magicui/ripple";
import { CREW_NAME } from "@/lib/sprites";

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

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
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

  const placeholder = groupMode
    ? "Den Den Mushi - the crew may chime in..."
    : `Message ${CREW_NAME[crewmate as keyof typeof CREW_NAME] ?? "the crew"}...`;

  // Collapse the avatar+name header when consecutive bubbles share an agent.
  const display = bubbles.map((b, i) => {
    const prev = bubbles[i - 1];
    return { ...b, showHeader: !prev || prev.agent !== b.agent };
  });

  return (
    <div className="relative flex h-full flex-col">
      {sending && bubbles.length === 0 && (
        <Ripple className="-mt-12" mainCircleSize={120} numCircles={5} />
      )}
      <div
        ref={scrollRef}
        className="flex-1 space-y-2 overflow-y-auto px-2 py-3"
      >
        {display.length === 0 && !sending && (
          <div className="mt-12 text-center text-xs text-zinc-500">
            Say hi. The crew is listening.
          </div>
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
    return (
      <div className="surface ml-9 px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">
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
        <div className="mt-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
          {parsed.haki_affinity ? (
            <span>{String(parsed.haki_affinity)}</span>
          ) : null}
          {parsed.base_bounty ? (
            <span>+{Number(parsed.base_bounty).toLocaleString()} bounty</span>
          ) : null}
        </div>
        <button
          onClick={() => acceptVoyage(parsed!)}
          className="mt-3 rounded-full bg-amber-400 px-3 py-1.5 text-[10px] uppercase tracking-widest text-zinc-900"
        >
          Add this
        </button>
      </div>
    );
  }
  if (action.name === "suggest_focus") {
    return (
      <div className="surface ml-9 px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-sky-300">
          Navigator&apos;s tip
        </div>
        <div className="mt-1 text-sm text-zinc-200">
          Focus the next 7 days on{" "}
          <span className="font-mono uppercase tracking-widest text-amber-300">
            {action.payload}
          </span>
          .
        </div>
      </div>
    );
  }
  return null;
}

async function acceptVoyage(payload: Record<string, unknown>) {
  const body = {
    title: String(payload.title ?? "New Voyage"),
    description: String(payload.description ?? ""),
    haki_affinity: String(payload.haki_affinity ?? "vitality"),
    base_bounty: Number(payload.base_bounty ?? 100000),
    base_berries: Number(payload.base_berries ?? 25),
    verification_mode: String(payload.verification_mode ?? "self"),
    recurrence: String(payload.recurrence ?? "one_shot"),
    cooldown_sec: 0,
    category: String(payload.category ?? "bounty_mission"),
    verifier_prompt: payload.verifier_prompt
      ? String(payload.verifier_prompt)
      : null,
    active: true,
  };
  try {
    const r = await fetch("/api/game/voyages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      alert(`Couldn't add: ${r.status}`);
      return;
    }
    alert("Added.");
  } catch (e) {
    alert(`Couldn't add: ${e}`);
  }
}
