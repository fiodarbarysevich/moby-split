"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Goal, GoalContribution, GoalProof } from "@/types";
import { QRCodeSVG } from "qrcode.react";
import confetti from "canvas-confetti";
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  Copy,
  ImagePlus,
  Loader2,
  PiggyBank,
  Upload,
  X,
} from "lucide-react";

function formatBYN(amount: number): string {
  return `${amount.toFixed(2)} BYN`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChildGoalPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const goalId = params.id;

  const [goal, setGoal] = useState<Goal | null>(null);
  const [proofs, setProofs] = useState<GoalProof[]>([]);
  const [contributions, setContributions] = useState<GoalContribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  const [showUpload, setShowUpload] = useState(false);
  const [proofDescription, setProofDescription] = useState("");
  const [proofPhoto, setProofPhoto] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasCelebratedRef = useRef(false);

  const parentUrl = useMemo(
    () => (origin && goal ? `${origin}/parent/goal/${goal.parent_token}` : ""),
    [origin, goal]
  );

  const { saved, progress } = useMemo(() => {
    if (!goal) return { saved: 0, progress: 0 };
    const sum = contributions
      .filter((c) => c.goal_id === goal.id)
      .reduce((s, c) => s + c.amount, 0);
    return {
      saved: sum,
      progress: goal.target_amount > 0 ? Math.min((sum / goal.target_amount) * 100, 100) : 0,
    };
  }, [contributions, goal]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function fetchGoal() {
      setIsLoading(true);
      setError(null);

      const [
        { data: goalData, error: goalError },
        { data: proofsData, error: proofsError },
        { data: contributionsData, error: contributionsError },
      ] = await Promise.all([
        supabase.from("goals").select("*").eq("id", goalId).single(),
        supabase.from("goal_proofs").select("*").eq("goal_id", goalId).order("created_at", {
          ascending: false,
        }),
        supabase
          .from("goal_contributions")
          .select("*")
          .eq("goal_id", goalId)
          .order("contributed_at", { ascending: false }),
      ]);

      if (!isMounted) return;

      if (goalError || proofsError || contributionsError) {
        setError(
          goalError?.message ?? proofsError?.message ?? contributionsError?.message ?? "Failed to load goal."
        );
        setIsLoading(false);
        return;
      }

      setGoal(goalData as Goal);
      setProofs((proofsData as GoalProof[]) ?? []);
      setContributions((contributionsData as GoalContribution[]) ?? []);
      setIsLoading(false);
    }

    fetchGoal();

    return () => {
      isMounted = false;
    };
  }, [goalId]);

  useEffect(() => {
    if (!goalId) return;

    const goalChannel = supabase
      .channel(`goal:${goalId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "goals", filter: `id=eq.${goalId}` },
        (payload) => setGoal(payload.new as Goal)
      )
      .subscribe();

    const proofsChannel = supabase
      .channel(`goal-proofs:${goalId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "goal_proofs", filter: `goal_id=eq.${goalId}` },
        async () => {
          const { data } = await supabase
            .from("goal_proofs")
            .select("*")
            .eq("goal_id", goalId)
            .order("created_at", { ascending: false });
          setProofs((data as GoalProof[]) ?? []);
        }
      )
      .subscribe();

    const contributionsChannel = supabase
      .channel(`goal-contributions:${goalId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "goal_contributions", filter: `goal_id=eq.${goalId}` },
        (payload) => {
          const newContribution = payload.new as GoalContribution;
          setContributions((prev) =>
            prev.some((c) => c.id === newContribution.id) ? prev : [newContribution, ...prev]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(goalChannel);
      supabase.removeChannel(proofsChannel);
      supabase.removeChannel(contributionsChannel);
    };
  }, [goalId]);

  useEffect(() => {
    if (goal && progress >= 100 && !hasCelebratedRef.current) {
      hasCelebratedRef.current = true;
      const end = Date.now() + 3000;
      const frame = () => {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ["#f59e0b", "#fbbf24", "#22c55e", "#16a34a"],
        });
        confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ["#f59e0b", "#fbbf24", "#22c55e", "#16a34a"],
        });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [goal, progress]);

  async function copyLink() {
    if (!parentUrl) return;
    try {
      await navigator.clipboard.writeText(parentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function handleProofFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }
    setProofPhoto(file);
    setProofPreview(URL.createObjectURL(file));
    setError(null);
  }

  async function uploadPhoto(file: File): Promise<{ url: string } | { error: string }> {
    const ext = file.name.split(".").pop() ?? "jpg";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("goal-photos")
      .upload(fileName, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return { error: uploadError.message };
    }

    const { data } = supabase.storage.from("goal-photos").getPublicUrl(fileName);
    return { url: data.publicUrl };
  }

  async function handleSubmitProof(e: React.FormEvent) {
    e.preventDefault();
    if (!goal || !proofPhoto) return;

    setIsUploading(true);
    setError(null);

    const result = await uploadPhoto(proofPhoto);
    if ("error" in result) {
      setError(`Failed to upload photo: ${result.error}`);
      setIsUploading(false);
      return;
    }
    const photoUrl = result.url;

    const { error: insertError } = await supabase.from("goal_proofs").insert({
      goal_id: goal.id,
      photo_url: photoUrl,
      description: proofDescription.trim() || null,
      status: "pending",
      reward_amount: goal.part_amount,
    });

    setIsUploading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setProofDescription("");
    setProofPhoto(null);
    setProofPreview(null);
    setShowUpload(false);
  }

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-moby-600 animate-spin" />
      </main>
    );
  }

  if (error || !goal) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-6 text-center">
          <p className="text-red-600">{error ?? "Goal not found."}</p>
          <button
            onClick={() => router.push("/piggy-bank")}
            className="mt-4 text-moby-600 font-medium hover:underline"
          >
            Back to goals
          </button>
        </div>
      </main>
    );
  }

  const approvedProofs = proofs.filter((p) => p.status === "approved");
  const pendingProofs = proofs.filter((p) => p.status === "pending");

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <button
          onClick={() => router.push("/piggy-bank")}
          className="flex items-center gap-1 text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8">
          <div className="flex items-start gap-4 mb-6">
            {goal.photo_url ? (
              <img
                src={goal.photo_url}
                alt={goal.title}
                className="w-20 h-20 rounded-2xl object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600">
                <PiggyBank className="w-10 h-10" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-slate-900 truncate">{goal.title}</h1>
              <p className="text-slate-500">by {goal.child_name}</p>
              {goal.description && (
                <p className="text-sm text-slate-600 mt-2">{goal.description}</p>
              )}
            </div>
          </div>

          <div className="bg-amber-50 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-amber-800 font-medium">Saved</span>
              <span className="text-sm text-amber-800 font-medium">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-4 bg-amber-100 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-moby-500 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-2xl font-bold text-amber-900">
              {formatBYN(saved)} <span className="text-base font-normal text-amber-700">of {formatBYN(goal.target_amount)}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-center mb-6">
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-xs text-slate-500">Each reward</p>
              <p className="text-lg font-bold text-slate-900">{formatBYN(goal.part_amount)}</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-xs text-slate-500">Parts</p>
              <p className="text-lg font-bold text-slate-900">{approvedProofs.length} / {goal.parts_count}</p>
            </div>
          </div>

          {goal.status === "pending" && (
            <div className="bg-slate-50 rounded-2xl p-5 text-center">
              <p className="text-slate-600 font-medium">Waiting for parent approval</p>
              <p className="text-sm text-slate-500 mt-1">Send the QR code or link below to your parent.</p>
            </div>
          )}

          {goal.status === "approved" && !showUpload && (
            <button
              onClick={() => setShowUpload(true)}
              className="w-full flex items-center justify-center gap-2 bg-moby-600 hover:bg-moby-700 text-white font-semibold py-4 rounded-xl transition active:scale-[0.98]"
            >
              <Camera className="w-5 h-5" />
              Upload proof
            </button>
          )}

          {goal.status === "funded" && (
            <div className="bg-moby-50 rounded-2xl p-5 text-center">
              <CheckCircle className="w-10 h-10 mx-auto text-moby-600 mb-2" />
              <p className="text-moby-800 font-bold text-lg">Goal funded!</p>
              <p className="text-moby-700">Great job, {goal.child_name}!</p>
            </div>
          )}

          {showUpload && (
            <form onSubmit={handleSubmitProof} className="mt-6 space-y-4 border-t pt-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Upload proof</h3>
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleProofFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-moby-400 rounded-2xl p-4 transition"
              >
                {proofPreview ? (
                  <img
                    src={proofPreview}
                    alt="Proof preview"
                    className="w-20 h-20 object-cover rounded-xl"
                  />
                ) : (
                  <>
                    <ImagePlus className="w-5 h-5 text-slate-400" />
                    <span className="text-slate-500">Tap to add a photo</span>
                  </>
                )}
              </button>
              <textarea
                value={proofDescription}
                onChange={(e) => setProofDescription(e.target.value)}
                placeholder="What did you do? (optional)"
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-moby-500 focus:ring-2 focus:ring-moby-200 outline-none transition resize-none"
              />
              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
              )}
              <button
                type="submit"
                disabled={isUploading || !proofPhoto}
                className="w-full flex items-center justify-center gap-2 bg-moby-600 hover:bg-moby-700 disabled:bg-slate-300 text-white font-semibold py-3 rounded-xl transition"
              >
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5" />
                )}
                {isUploading ? "Uploading..." : "Send to parent"}
              </button>
            </form>
          )}
        </div>

        {parentUrl && goal.status !== "funded" && goal.status !== "declined" && (
          <div className="bg-white rounded-3xl shadow-xl p-6 text-center">
            <h3 className="font-semibold text-slate-900 mb-4">Show this to your parent</h3>
            <div className="flex justify-center mb-4">
              <QRCodeSVG value={parentUrl} size={160} level="M" />
            </div>
            <button
              onClick={copyLink}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium px-5 py-2 rounded-xl transition"
            >
              <Copy className="w-4 h-4" />
              {copied ? "Copied!" : "Copy parent link"}
            </button>
          </div>
        )}

        {proofs.length > 0 && (
          <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8">
            <h3 className="font-bold text-slate-900 mb-4">My proofs</h3>
            <div className="space-y-4">
              {proofs.map((proof) => (
                <div key={proof.id} className="flex gap-3 p-3 rounded-xl bg-slate-50">
                  <img
                    src={proof.photo_url}
                    alt="Proof"
                    className="w-16 h-16 rounded-xl object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900 truncate">
                      {proof.description || "Proof submitted"}
                    </p>
                    <p className="text-xs text-slate-500">{formatDateTime(proof.created_at)}</p>
                    <span
                      className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${
                        proof.status === "approved"
                          ? "bg-moby-100 text-moby-700"
                          : proof.status === "declined"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {proof.status === "approved"
                        ? `+${formatBYN(proof.reward_amount)}`
                        : proof.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
