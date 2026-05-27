"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowLeft, Camera, CheckCircle2, Clock, Flame, RotateCcw } from "lucide-react";
import { attemptVoyage, getVoyage } from "@/lib/api";
import type { AttemptResult, VoyageDTO } from "@/lib/api";
import { BorderBeam } from "@/components/magicui/border-beam";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { DropReveal } from "@/components/DropReveal";
import { PixelPortrait } from "@/components/PixelPortrait";
import { TimerStage } from "@/components/TimerStage";
import { VictoryReinforce } from "@/components/VictoryReinforce";
import { Term } from "@/components/Term";
import { HAKI_ACCENT, HAKI_LABEL, spritePath, voyageIcon } from "@/lib/sprites";

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

  const submit = useCallback(async () => {
    if (!voyage) return;
    setError(null);
    setStage("verifying");
    try {
      const mode = voyage.verification_mode;
      const r = await attemptVoyage(voyageId, {
        mode,
        image: mode === "marine_photo" ? image ?? undefined : undefined,
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
  }, [voyage, voyageId, image]);

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

  const isMarine = voyage.verification_mode === "marine_photo";
  const isTimer = voyage.verification_mode === "timer";
  const haki = HAKI_ACCENT[voyage.haki_affinity];
  const streak = voyage.streak?.current ?? 0;
  const hasStreak = streak > 0;

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
              <Chip>
                <VerifyIcon mode={voyage.verification_mode} className="mr-1 inline-block h-3 w-3 align-text-bottom" />
                {voyage.verification_mode.replace("_", " ")}
              </Chip>
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

      {/* Capture / submit */}
      {stage !== "result" && (
        isTimer ? (
          <TimerStage
            voyageId={voyageId}
            durationSec={voyage.cooldown_sec || 60}
            title={voyage.title}
            accentColor={haki}
            submitting={stage === "verifying"}
            onComplete={submit}
            onAbort={() => router.back()}
          />
        ) : (
          <div className="surface px-4 py-4">
            {isMarine ? (
              <>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                  <Camera className="h-3.5 w-3.5" />
                  <Term k="marine_photo">Marine verifier</Term>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Snap the proof. The Den Den Mushi will judge.
                </p>
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview}
                    alt="evidence"
                    className="mt-3 max-h-80 w-full rounded-2xl object-cover"
                  />
                ) : (
                  <button
                    onClick={() => inputRef.current?.click()}
                    className="mt-3 flex h-56 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] text-zinc-400 hover:bg-white/[0.04]"
                  >
                    <Camera className="h-7 w-7" />
                    <span className="text-xs uppercase tracking-widest">
                      Tap to capture
                    </span>
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
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <Term k="self">Self report</Term>
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Mark it done when the deed is real.
                </p>
              </>
            )}

            {error && (
              <div className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {error}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              {isMarine && preview && (
                <button
                  onClick={() => {
                    setImage(null);
                    setPreview(null);
                    setStage("idle");
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/10 px-4 py-2.5 text-xs uppercase tracking-widest text-zinc-300 hover:bg-white/5"
                >
                  <RotateCcw className="h-3 w-3" />
                  Retake
                </button>
              )}
              <ShimmerButton
                onClick={submit}
                disabled={stage === "verifying" || (isMarine && !image)}
                borderRadius="9999px"
                background="linear-gradient(135deg, #f59e0b, #f97316)"
                shimmerColor="#fff5cc"
                className="flex-1 text-xs uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-40"
              >
                {stage === "verifying"
                  ? isMarine
                    ? "Den Den Mushi calling..."
                    : "Stamping..."
                  : isMarine
                    ? "Submit"
                    : "Mark complete"}
              </ShimmerButton>
            </div>
          </div>
        )
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

function VerifyIcon({
  mode,
  className,
}: {
  mode: VoyageDTO["verification_mode"];
  className?: string;
}) {
  if (mode === "marine_photo") return <Camera className={className} />;
  if (mode === "timer") return <Clock className={className} />;
  return <CheckCircle2 className={className} />;
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
