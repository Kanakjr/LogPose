"use client";

import { motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import { PixelPortrait } from "@/components/PixelPortrait";
import { CREW_ACCENT, CREW_NAME, CREW_SPRITE } from "@/lib/sprites";
import { cn } from "@/lib/utils";

type Props = {
  agent: string;
  content: string;
  /** If true, render a typing dots indicator after the (possibly empty) content. */
  streaming?: boolean;
  /** Suppress avatar+name when consecutive bubbles share an agent. */
  showHeader?: boolean;
};

export function ChatBubble({
  agent,
  content,
  streaming = false,
  showHeader = true,
}: Props) {
  if (agent === "user") return <UserBubble content={content} />;
  return (
    <CrewBubble
      agent={agent}
      content={content}
      streaming={streaming}
      showHeader={showHeader}
    />
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="ml-auto flex max-w-[82%] justify-end"
    >
      <div className="rounded-2xl rounded-br-md bg-gradient-to-br from-amber-400 to-amber-500 px-3.5 py-2 text-sm text-zinc-900 shadow-sm">
        <div className="whitespace-pre-wrap break-words">{content}</div>
      </div>
    </motion.div>
  );
}

function CrewBubble({
  agent,
  content,
  streaming,
  showHeader,
}: {
  agent: string;
  content: string;
  streaming: boolean;
  showHeader: boolean;
}) {
  const key = agent as keyof typeof CREW_SPRITE;
  const sprite = CREW_SPRITE[key];
  const accent = CREW_ACCENT[key] ?? "#facc15";
  const name = CREW_NAME[key] ?? agent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mr-auto flex max-w-[88%] items-end gap-2"
    >
      {showHeader && sprite ? (
        <PixelPortrait
          src={sprite.chip}
          size={28}
          rounded="rounded-lg"
          alt={name}
          className="shrink-0"
        />
      ) : (
        <div className="w-7 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        {showHeader && (
          <div
            className="mb-0.5 text-[11px] font-semibold"
            style={{ color: accent }}
          >
            {name}
          </div>
        )}
        <div
          className={cn(
            "relative inline-block max-w-full rounded-2xl rounded-bl-md px-3.5 py-2 text-sm text-zinc-100 shadow-sm",
            "bg-zinc-800/80 backdrop-blur",
          )}
          style={{ borderLeft: `2px solid ${accent}55` }}
        >
          {content || streaming ? (
            <div className="prose prose-invert prose-sm max-w-none break-words [&>p]:my-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0">
              <ReactMarkdown>{content || ""}</ReactMarkdown>
              {streaming && <TypingDots />}
            </div>
          ) : (
            <TypingDots />
          )}
        </div>
      </div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <span className="ml-1 inline-flex items-center gap-0.5 align-middle">
      <span
        className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-zinc-400"
        style={{ animationDelay: "0s" }}
      />
      <span
        className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-zinc-400"
        style={{ animationDelay: "0.15s" }}
      />
      <span
        className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-zinc-400"
        style={{ animationDelay: "0.3s" }}
      />
    </span>
  );
}
