"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { CreatePoolPayload } from "@/types";
import { Calculator, Plus, Users, Wallet } from "lucide-react";

function formatBYN(amount: number): string {
  return `${amount.toFixed(2)} BYN`;
}

export default function CreatePoolPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [participantsCount, setParticipantsCount] = useState<string>("2");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericTotal = useMemo(() => {
    const value = parseFloat(totalAmount);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }, [totalAmount]);

  const numericParticipants = useMemo(() => {
    const value = parseInt(participantsCount, 10);
    return Number.isFinite(value) && value >= 2 ? value : 2;
  }, [participantsCount]);

  const shareAmount = useMemo(() => {
    if (numericParticipants === 0) return 0;
    return Math.ceil((numericTotal / numericParticipants) * 100) / 100;
  }, [numericTotal, numericParticipants]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Please enter a pool title.");
      return;
    }

    if (numericTotal <= 0) {
      setError("Total amount must be greater than 0.");
      return;
    }

    setIsSubmitting(true);

    const payload: CreatePoolPayload = {
      title: title.trim(),
      total_amount: numericTotal,
      participants_count: numericParticipants,
      share_amount: shareAmount,
    };

    const { data, error: insertError } = await supabase
      .from("pools")
      .insert(payload)
      .select("id")
      .single();

    setIsSubmitting(false);

    if (insertError || !data) {
      setError(insertError?.message ?? "Failed to create pool.");
      return;
    }

    router.push(`/pool/${data.id}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-moby-100 flex items-center justify-center text-moby-600">
            <Wallet className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Moby Split
          </h1>
        </div>
        <p className="text-slate-500 mb-8">
          Create a shared pool and split the bill with friends.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-slate-700 mb-2"
            >
              Pool title
            </label>
            <div className="relative">
              <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Gift for colleague"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-moby-500 focus:ring-2 focus:ring-moby-200 outline-none transition"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="totalAmount"
              className="block text-sm font-medium text-slate-700 mb-2"
            >
              Total amount (BYN)
            </label>
            <div className="relative">
              <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="totalAmount"
                type="number"
                min="0.01"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-moby-500 focus:ring-2 focus:ring-moby-200 outline-none transition"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">
                BYN
              </span>
            </div>
          </div>

          <div>
            <label
              htmlFor="participantsCount"
              className="block text-sm font-medium text-slate-700 mb-2"
            >
              Number of participants
            </label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="participantsCount"
                type="number"
                min="2"
                step="1"
                value={participantsCount}
                onChange={(e) => setParticipantsCount(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-moby-500 focus:ring-2 focus:ring-moby-200 outline-none transition"
              />
            </div>
          </div>

          <div className="bg-moby-50 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-moby-700 font-medium">Per person</p>
              <p className="text-3xl font-bold text-moby-800">
                {formatBYN(shareAmount)}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-moby-100 flex items-center justify-center text-moby-600">
              <Calculator className="w-6 h-6" />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 bg-moby-600 hover:bg-moby-700 disabled:bg-slate-300 text-white font-semibold py-4 rounded-xl transition active:scale-[0.98]"
          >
            {isSubmitting ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Plus className="w-5 h-5" />
            )}
            {isSubmitting ? "Creating..." : "Create Pool"}
          </button>
        </form>
      </div>
    </main>
  );
}
