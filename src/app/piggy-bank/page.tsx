"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Goal, GoalContribution } from "@/types";
import { ArrowLeft, Gift, Landmark, Loader2, PiggyBank, Plus, ShieldCheck, Smile } from "lucide-react";

function formatBYN(amount: number): string {
  return `${amount.toFixed(2)} BYN`;
}

function statusBadge(status: Goal["status"]) {
  switch (status) {
    case "approved":
      return "bg-moby-100 text-moby-700";
    case "funded":
      return "bg-amber-100 text-amber-700";
    case "declined":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function statusLabel(status: Goal["status"]) {
  switch (status) {
    case "approved":
      return "In progress";
    case "funded":
      return "Funded";
    case "declined":
      return "Declined";
    default:
      return "Waiting for parent";
  }
}

export default function PiggyBankDashboardPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [contributions, setContributions] = useState<GoalContribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchGoals() {
      const [{ data: goalsData, error: goalsError }, { data: contributionsData }] =
        await Promise.all([
          supabase.from("goals").select("*").order("created_at", { ascending: false }),
          supabase.from("goal_contributions").select("*"),
        ]);

      if (!isMounted) return;
      if (goalsError) {
        console.error(goalsError);
      }
      setGoals((goalsData as Goal[]) ?? []);
      setContributions((contributionsData as GoalContribution[]) ?? []);
      setIsLoading(false);
    }

    fetchGoals();

    const goalsChannel = supabase
      .channel("piggy-bank-goals")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "goals" },
        () => fetchGoals()
      )
      .subscribe();

    const contributionsChannel = supabase
      .channel("piggy-bank-contributions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "goal_contributions" },
        () => fetchGoals()
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(goalsChannel);
      supabase.removeChannel(contributionsChannel);
    };
  }, []);

  const progressByGoal = useMemo(() => {
    const map: Record<string, number> = {};
    for (const goal of goals) {
      const sum = contributions
        .filter((c) => c.goal_id === goal.id)
        .reduce((s, c) => s + c.amount, 0);
      map[goal.id] = goal.target_amount > 0
        ? Math.min((sum / goal.target_amount) * 100, 100)
        : 0;
    }
    return map;
  }, [goals, contributions]);

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-gradient-to-br from-amber-400 to-amber-500 rounded-3xl shadow-xl p-6 sm:p-8 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <PiggyBank className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Piggy Bank</h1>
              <p className="opacity-90">Save up for something awesome!</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">My Goals</h2>
          <button
            onClick={() => router.push("/piggy-bank/create")}
            className="flex items-center gap-2 bg-moby-600 hover:bg-moby-700 text-white font-semibold px-4 py-2 rounded-xl transition active:scale-[0.98]"
          >
            <Plus className="w-5 h-5" />
            New goal
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-moby-600 animate-spin" />
          </div>
        ) : goals.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-lg p-10 text-center">
            <Smile className="w-12 h-12 mx-auto text-amber-400 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No goals yet
            </h3>
            <p className="text-slate-500 mb-6">
              Create your first goal and start saving!
            </p>
            <button
              onClick={() => router.push("/piggy-bank/create")}
              className="inline-flex items-center gap-2 bg-moby-600 hover:bg-moby-700 text-white font-semibold px-6 py-3 rounded-xl transition"
            >
              <Plus className="w-5 h-5" />
              Create goal
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {goals.map((goal) => (
              <button
                key={goal.id}
                onClick={() => router.push(`/piggy-bank/goal/${goal.id}`)}
                className="text-left bg-white rounded-2xl shadow-lg p-5 hover:shadow-xl transition active:scale-[0.98]"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="font-bold text-slate-900 truncate">{goal.title}</h3>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full shrink-0 ${statusBadge(
                      goal.status
                    )}`}
                  >
                    {statusLabel(goal.status)}
                  </span>
                </div>
                <p className="text-2xl font-bold text-moby-700 mb-3">
                  {formatBYN(goal.target_amount)}
                </p>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${progressByGoal[goal.id] ?? 0}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {Math.round(progressByGoal[goal.id] ?? 0)}% saved
                </p>
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => router.push("/piggy-bank/wallets")}
            className="text-left bg-white rounded-2xl shadow-lg p-5 hover:shadow-xl transition active:scale-[0.98]"
          >
            <Landmark className="w-7 h-7 mb-3 text-emerald-500" />
            <h3 className="font-bold text-slate-900">My Wallets</h3>
            <p className="text-sm text-slate-500 mt-1">Spend, Save, Give</p>
          </button>
          <button
            onClick={() => router.push("/piggy-bank/gift-links")}
            className="text-left bg-white rounded-2xl shadow-lg p-5 hover:shadow-xl transition active:scale-[0.98]"
          >
            <Gift className="w-7 h-7 mb-3 text-rose-500" />
            <h3 className="font-bold text-slate-900">Gift Links</h3>
            <p className="text-sm text-slate-500 mt-1">Links & QR codes for relatives</p>
          </button>
          <button
            onClick={() => router.push("/family-banking")}
            className="text-left bg-white rounded-2xl shadow-lg p-5 hover:shadow-xl transition active:scale-[0.98] sm:col-span-2"
          >
            <ShieldCheck className="w-7 h-7 mb-3 text-moby-600" />
            <h3 className="font-bold text-slate-900">Симуляция семейного банкинга</h3>
            <p className="text-sm text-slate-500 mt-1">
              KYC родителя, верифицируемое согласие, возрастные карты и compliance
            </p>
          </button>
        </div>

        <button
          onClick={() => router.push("/")}
          className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-slate-700 text-sm py-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Moby Split
        </button>
      </div>
    </main>
  );
}
