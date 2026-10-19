"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Goal, GoalContribution, GoalProof, GoalStatus } from "@/types";
import confetti from "canvas-confetti";
import {
  CheckCircle,
  Loader2,
  PiggyBank,
  ThumbsDown,
  ThumbsUp,
  XCircle,
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

export default function ParentGoalPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [goal, setGoal] = useState<Goal | null>(null);
  const [proofs, setProofs] = useState<GoalProof[]>([]);
  const [contributions, setContributions] = useState<GoalContribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionProofId, setActionProofId] = useState<string | null>(null);
  const [hasCelebrated, setHasCelebrated] = useState(false);

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
    let isMounted = true;

    async function fetchGoal() {
      setIsLoading(true);
      setError(null);

      const { data: goalData, error: goalError } = await supabase
        .from("goals")
        .select("*")
        .eq("parent_token", token)
        .single();

      if (!isMounted) return;

      if (goalError || !goalData) {
        setError(goalError?.message ?? "Goal not found.");
        setIsLoading(false);
        return;
      }

      const goalId = (goalData as Goal).id;

      const [
        { data: proofsData, error: proofsError },
        { data: contributionsData, error: contributionsError },
      ] = await Promise.all([
        supabase
          .from("goal_proofs")
          .select("*")
          .eq("goal_id", goalId)
          .order("created_at", { ascending: false }),
        supabase
          .from("goal_contributions")
          .select("*")
          .eq("goal_id", goalId)
          .order("contributed_at", { ascending: false }),
      ]);

      if (!isMounted) return;

      if (proofsError || contributionsError) {
        setError(proofsError?.message ?? contributionsError?.message ?? "Failed to load proofs.");
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
  }, [token]);

  useEffect(() => {
    if (!goal) return;

    const goalChannel = supabase
      .channel(`parent-goal:${goal.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "goals", filter: `id=eq.${goal.id}` },
        (payload) => setGoal(payload.new as Goal)
      )
      .subscribe();

    const proofsChannel = supabase
      .channel(`parent-goal-proofs:${goal.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "goal_proofs", filter: `goal_id=eq.${goal.id}` },
        async () => {
          const { data } = await supabase
            .from("goal_proofs")
            .select("*")
            .eq("goal_id", goal.id)
            .order("created_at", { ascending: false });
          setProofs((data as GoalProof[]) ?? []);
        }
      )
      .subscribe();

    const contributionsChannel = supabase
      .channel(`parent-goal-contributions:${goal.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "goal_contributions", filter: `goal_id=eq.${goal.id}` },
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
  }, [goal?.id]);

  useEffect(() => {
    if (goal && progress >= 100 && !hasCelebrated) {
      setHasCelebrated(true);
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
  }, [goal, progress, hasCelebrated]);

  async function updateGoalStatus(status: GoalStatus) {
    if (!goal) return;
    const { error: updateError } = await supabase
      .from("goals")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", goal.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setGoal({ ...goal, status });
  }

  async function handleProofDecision(proof: GoalProof, approved: boolean) {
    if (!goal) return;
    setActionProofId(proof.id);

    const newStatus = approved ? "approved" : "declined";
    const { error: updateError } = await supabase
      .from("goal_proofs")
      .update({ status: newStatus, approved_at: approved ? new Date().toISOString() : null })
      .eq("id", proof.id);

    if (updateError) {
      setError(updateError.message);
      setActionProofId(null);
      return;
    }

    if (approved) {
      const { error: contributionError } = await supabase.from("goal_contributions").insert({
        goal_id: goal.id,
        proof_id: proof.id,
        amount: proof.reward_amount,
      });

      if (contributionError) {
        setError(contributionError.message);
        setActionProofId(null);
        return;
      }

      const newSaved = saved + proof.reward_amount;
      if (newSaved >= goal.target_amount) {
        await supabase
          .from("goals")
          .update({ status: "funded", updated_at: new Date().toISOString() })
          .eq("id", goal.id);
      }
    }

    setProofs((prev) =>
      prev.map((p) =>
        p.id === proof.id
          ? {
              ...p,
              status: newStatus,
              approved_at: approved ? new Date().toISOString() : null,
            }
          : p
      )
    );

    setActionProofId(null);
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
        </div>
      </main>
    );
  }

  const pendingProofs = proofs.filter((p) => p.status === "pending");
  const processedProofs = proofs.filter((p) => p.status !== "pending");

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <PiggyBank className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm opacity-80">Parent review</p>
              <h1 className="text-2xl font-bold">{goal.title}</h1>
            </div>
          </div>
          <p className="opacity-80">by {goal.child_name}</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8">
          {goal.status === "pending" && (
            <div className="text-center">
              <p className="text-slate-600 mb-6">
                {goal.child_name} wants to save for <strong>{goal.title}</strong>.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 rounded-2xl p-4">
                  <p className="text-xs text-slate-500">Total price</p>
                  <p className="text-xl font-bold text-slate-900">{formatBYN(goal.target_amount)}</p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4">
                  <p className="text-xs text-slate-500">Reward per proof</p>
                  <p className="text-xl font-bold text-moby-700">{formatBYN(goal.part_amount)}</p>
                </div>
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => updateGoalStatus("approved")}
                  className="flex items-center gap-2 bg-moby-600 hover:bg-moby-700 text-white font-semibold px-6 py-3 rounded-xl transition"
                >
                  <ThumbsUp className="w-5 h-5" />
                  Accept goal
                </button>
                <button
                  onClick={() => updateGoalStatus("declined")}
                  className="flex items-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 font-semibold px-6 py-3 rounded-xl transition"
                >
                  <ThumbsDown className="w-5 h-5" />
                  Decline
                </button>
              </div>
            </div>
          )}

          {goal.status === "declined" && (
            <div className="text-center py-8">
              <XCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
              <p className="text-lg font-semibold text-slate-900">Goal declined</p>
              <p className="text-slate-500">You have declined this goal.</p>
            </div>
          )}

          {(goal.status === "approved" || goal.status === "funded") && (
            <>
              <div className="mb-6">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium text-slate-700">
                    Saved: {formatBYN(saved)} of {formatBYN(goal.target_amount)} ({Math.round(progress)}%)
                  </span>
                  {goal.status === "funded" && (
                    <span className="inline-flex items-center gap-1 text-moby-600 font-semibold">
                      <CheckCircle className="w-4 h-4" />
                      Fully funded
                    </span>
                  )}
                </div>
                <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-moby-500 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <h2 className="font-bold text-slate-900 mb-4">Pending proofs</h2>
              {pendingProofs.length === 0 ? (
                <p className="text-slate-500 bg-slate-50 rounded-2xl p-4 mb-6">
                  No proofs waiting for review.
                </p>
              ) : (
                <div className="space-y-4 mb-6">
                  {pendingProofs.map((proof) => (
                    <div key={proof.id} className="border border-slate-200 rounded-2xl p-4">
                      <img
                        src={proof.photo_url}
                        alt="Proof"
                        className="w-full h-64 object-cover rounded-xl mb-3"
                      />
                      {proof.description && (
                        <p className="text-slate-700 mb-3">{proof.description}</p>
                      )}
                      <p className="text-xs text-slate-500 mb-3">{formatDateTime(proof.created_at)}</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleProofDecision(proof, true)}
                          disabled={actionProofId === proof.id}
                          className="flex-1 flex items-center justify-center gap-2 bg-moby-600 hover:bg-moby-700 disabled:bg-slate-300 text-white font-semibold py-3 rounded-xl transition"
                        >
                          {actionProofId === proof.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <ThumbsUp className="w-5 h-5" />
                          )}
                          Send {formatBYN(proof.reward_amount)}
                        </button>
                        <button
                          onClick={() => handleProofDecision(proof, false)}
                          disabled={actionProofId === proof.id}
                          className="flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 disabled:bg-slate-100 text-red-700 font-semibold px-4 rounded-xl transition"
                        >
                          <ThumbsDown className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {processedProofs.length > 0 && (
                <>
                  <h2 className="font-bold text-slate-900 mb-4">History</h2>
                  <div className="space-y-3">
                    {processedProofs.map((proof) => (
                      <div key={proof.id} className="flex gap-3 p-3 rounded-xl bg-slate-50">
                        <img
                          src={proof.photo_url}
                          alt="Proof"
                          className="w-14 h-14 rounded-xl object-cover shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-900 truncate">
                            {proof.description || "Proof"}
                          </p>
                          <p className="text-xs text-slate-500">{formatDateTime(proof.created_at)}</p>
                        </div>
                        <span
                          className={`shrink-0 text-sm font-bold ${
                            proof.status === "approved" ? "text-moby-700" : "text-red-600"
                          }`}
                        >
                          {proof.status === "approved" ? `+${formatBYN(proof.reward_amount)}` : "Declined"}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
