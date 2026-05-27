"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Flame,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { attemptVoyage, getVoyage } from "@/lib/api";
import type { AttemptResult, VoyageDTO } from "@/lib/api";
import { BorderBeam } from "@/components/magicui/border-beam";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { DropReveal } from "@/components/DropReveal";
import { PixelPortrait } from "@/components/PixelPortrait";
import { VictoryReinforce } from "@/components/VictoryReinforce";
import { HAKI_ACCENT, HAKI_LABEL, spritePath, voyageIcon } from "@/lib/sprites";
import { WINDOW_ACCENT, WINDOW_LABEL } from "@/lib/timeWindow";

type Stage = "idle" | "captured" | "verifying" | "result";

export default function VoyageDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const voyageId = Number(params.id);

  const [voyage, setVoyage] = useState<VoyageDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<Stage>("idle");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!Number.isFinite(voyageId)) return;
    getVoyage(voyageId)
      .then(setVoyage)
      .finally(() => setLoading(false));
  }, [voyageId]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImage(f);
    setPreview(URL.createObjectURL(f));
    setStage("captured");
    setError(null);
  }

  function clearImage() {
    setImage(null);
    setPreview(null);
    setStage("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  // submit() always works - photo is optional. If the user attached one we
  // ship it; if not we just mark the voyage complete and take the base reward.
  const submit = useCallback(
    async (withPhoto: boolean) => {
      if (!voyage) return;
      setError(null);
      setStage("verifying");
      try {
        const r = await attemptVoyage(voyageId, {
          mode: "self",
          image: withPhoto && image ? image : undefined,
        });
        setResult(r);
        setStage("result");
        if (r.drop && r.drop.kind !== "nothing") {
          setDropOpen(true);
        }
      } catch (e) {
        setError(String(e));
        setStage(image ? "captured" : "idle");
      }
    },
    [voyage, voyageId, image],
  );

  function reset() {
    setImage(null);
    setPreview(null);
    setResult(null);
    setStage("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  if (loading)
    return (
      <div className="mt-16 text-center text-sm text-zinc-500">
        Charting course...
      </div>
    );
  if (!voyage)
    return (
      <div className="mt-16 text-center text-sm text-rose-300">
        Voyage not found.
      </div>
    );

  const haki = HAKI_ACCENT[voyage.haki_affinity];
  const streak = voyage.streak?.current ?? 0;
  const hasStreak = streak > 0;
  const bonusPct = voyage.evidence_bonus_pct ?? 0;
  const windowKey = voyage.time_window ?? "anytime";
  const windowAccent = WINDOW_ACCENT[windowKey];
  const verifying = stage === "verifying";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-xs uppercase tracking-widest text-zinc-500 hover:text-zinc-200"
      >
        <ArrowLeft className="h-3 w-3" />
        Back
      </button>

      {/* Hero card */}
      <div className="surface relative overflow-hidden px-4 py-4">
        {hasStreak && (
          <BorderBeam size={70} duration={7} colorFrom={haki} colorTo="#facc15" />
        )}
        <div className="flex items-start gap-3">
          <PixelPortrait
            src={spritePath(voyageIcon(voyage))}
            size={64}
            rounded="rounded-2xl"
            alt=""
          />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-xl font-semibold text-zinc-50">
              {voyage.title}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">{voyage.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] uppercase tracking-widest">
              <Chip>+{voyage.base_bounty.toLocaleString()} bounty</Chip>
              <Chip>+{voyage.base_berries} berries</Chip>
              <Chip color={haki}>{HAKI_LABEL[voyage.haki_affinity]}</Chip>
              <Chip color={windowAccent}>{WINDOW_LABEL[windowKey]}</Chip>
              {bonusPct > 0 && (
                <Chip color="#fde047">
                  <Sparkles className="mr-1 inline-block h-3 w-3 align-text-bottom" />
                  +{bonusPct}% with photo
                </Chip>
              )}
              {hasStreak && (
                <Chip color="#fb923c">
                  <Flame className="mr-1 inline-block h-3 w-3 align-text-bottom" />
                  {streak} day streak
                </Chip>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Completion surface */}
      {stage !== "result" && (
        <div className="surface px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Mark complete
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Tap done when the deed is real. Photo is optional - snap one for
                {bonusPct > 0 ? ` +${bonusPct}% bonus bounty.` : " your records."}
              </p>
            </div>
          </div>

          {preview ? (
            <div className="relative mt-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="evidence"
                className="max-h-80 w-full rounded-2xl object-cover"
              />
              <button
                aria-label="Remove photo"
                onClick={clearImage}
                disabled={verifying}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-zinc-100 hover:bg-black/80 disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => inputRef.current?.click()}
              disabled={verifying}
              className="mt-4 flex h-44 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] text-zinc-400 hover:bg-white/[0.04] disabled:opacity-40"
            >
              <Camera className="h-7 w-7" />
              <span className="text-xs uppercase tracking-widest">
                Tap to add proof (optional)
              </span>
              {bonusPct > 0 && (
                <span className="text-[10px] uppercase tracking-widest text-amber-300/80">
                  +{bonusPct}% bounty &middot; +{bonusPct}% berries
                </span>
              )}
            </button>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPick}
            className="hidden"
          />

          {error && (
            <div className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {preview ? (
              <>
                <button
                  onClick={clearImage}
                  disabled={verifying}
                  className="flex items-center justify-center gap-1.5 rounded-full border border-white/10 px-4 py-2.5 text-xs uppercase tracking-widest text-zinc-300 hover:bg-white/5 disabled:opacity-40 sm:flex-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Retake
                </button>
                <ShimmerButton
                  onClick={() => submit(true)}
                  disabled={verifying}
                  borderRadius="9999px"
                  background="linear-gradient(135deg, #f59e0b, #f97316)"
                  shimmerColor="#fff5cc"
                  className="text-xs uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-40 sm:flex-[2]"
                >
                  {verifying
                    ? "Logging..."
                    : bonusPct > 0
                      ? `Submit with photo (+${bonusPct}%)`
                      : "Submit with photo"}
                </ShimmerButton>
              </>
            ) : (
              <>
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={verifying}
                  className="flex items-center justify-center gap-1.5 rounded-full border border-white/10 px-4 py-2.5 text-xs uppercase tracking-widest text-zinc-300 hover:bg-white/5 disabled:opacity-40 sm:flex-1"
                >
                  <Camera className="h-3 w-3" />
                  Add photo
                </button>
                <ShimmerButton
                  onClick={() => submit(false)}
                  disabled={verifying}
                  borderRadius="9999px"
                  background="linear-gradient(135deg, #facc15, #f59e0b)"
                  shimmerColor="#fff5cc"
                  className="text-xs uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-40 sm:flex-[2]"
                >
                  {verifying ? "Stamping..." : "Mark complete"}
                </ShimmerButton>
              </>
            )}
          </div>
        </div>
      )}

      {stage === "result" && result && (
        <>
          <ResultPanel result={result} onClose={reset} onBack={() => router.back()} />
          {["verified", "self_reported", "timer_done"].includes(result.verdict) && (
            <VictoryReinforce voyage={voyage} result={result} />
          )}
        </>
      )}

      <DropReveal
        drop={result?.drop ?? null}
        open={dropOpen}
        onClose={() => setDropOpen(false)}
      />
    </div>
  );
}

function Chip({
  children,
  color = "#a1a1aa",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span
      className="rounded-full bg-white/5 px-2 py-1 font-medium"
      style={{ color }}
    >
      {children}
    </span>
  );
}

function ResultPanel({
  result,
  onClose,
  onBack,
}: {
  result: AttemptResult;
  onClose: () => void;
  onBack: () => void;
}) {
  const ok = ["verified", "self_reported", "timer_done"].includes(result.verdict);
  const bonus = result.bonus_applied;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div
        className={`surface verdict-flash px-5 py-5 text-center ${
          ok ? "border-amber-400/40" : "border-rose-500/40"
        }`}
      >
        <div
          className={`font-display text-3xl font-bold ${
            ok ? "text-amber-300" : "text-rose-300"
          }`}
        >
          {ok ? "Victory" : "Rejected"}
        </div>
        <p className="mt-2 px-2 text-xs text-zinc-400">{result.reasoning}</p>
        {ok && (
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                Bounty
              </div>
              <div className="font-mono text-amber-300">
                +{result.bounty_awarded.toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                Berries
              </div>
              <div className="font-mono text-sky-300">
                +{result.berries_awarded.toLocaleString()}
              </div>
            </div>
          </div>
        )}
        {ok && bonus && (result.bonus_bounty > 0 || result.bonus_berries > 0) && (
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.18, type: "spring", stiffness: 280 }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] uppercase tracking-widest text-amber-300"
          >
            <Sparkles className="h-3 w-3" />
            Photo bonus +{result.evidence_bonus_pct}% &middot;{" "}
            +{result.bonus_bounty.toLocaleString()} B &middot;{" "}
            +{result.bonus_berries.toLocaleString()} ₿
          </motion.div>
        )}
        {ok && !bonus && result.evidence_bonus_pct > 0 && !result.image_path && (
          <p className="mt-3 text-[11px] uppercase tracking-widest text-zinc-500">
            Snap proof next time for +{result.evidence_bonus_pct}% bonus
          </p>
        )}
      </div>

      {ok && result.tier_up && (
        <motion.div
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 300 }}
          className="surface px-4 py-3 text-center"
        >
          <div className="text-[10px] uppercase tracking-widest text-rose-300">
            Bounty tier raised
          </div>
          <div className="mt-1 font-display text-lg text-zinc-100">
            {result.tier_up.from} → {result.tier_up.to}
          </div>
        </motion.div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-full border border-white/10 px-4 py-2.5 text-xs uppercase tracking-widest text-zinc-300 hover:bg-white/5"
        >
          Try again
        </button>
        <button
          onClick={onBack}
          className="flex-1 rounded-full bg-amber-400 px-4 py-2.5 text-xs uppercase tracking-widest text-zinc-900"
        >
          Back to today
        </button>
      </div>
    </motion.div>
  );
}
