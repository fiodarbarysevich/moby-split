"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Pool } from "@/types";
import { Check, CreditCard, Loader2, Wallet } from "lucide-react";

function formatBYN(amount: number): string {
  return `${amount.toFixed(2)} BYN`;
}

export default function PayPage() {
  const params = useParams<{ id: string }>();
  const poolId = params.id;

  const [pool, setPool] = useState<Pool | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [payerName, setPayerName] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchPool() {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("pools")
        .select("*")
        .eq("id", poolId)
        .single();

      if (!isMounted) return;

      if (fetchError || !data) {
        setError(fetchError?.message ?? "Pool not found.");
        setIsLoading(false);
        return;
      }

      setPool(data as Pool);
      setIsLoading(false);
    }

    fetchPool();

    return () => {
      isMounted = false;
    };
  }, [poolId]);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!pool || !payerName.trim()) return;

    setIsPaying(true);

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const { error: insertError } = await supabase.from("payments").insert({
      pool_id: poolId,
      payer_name: payerName.trim(),
      amount: pool.share_amount,
    });

    setIsPaying(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setIsSuccess(true);
  }

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Loader2 className="w-8 h-8 text-moby-600 animate-spin" />
      </main>
    );
  }

  if (error || !pool) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-lg p-6 text-center">
          <p className="text-red-600">{error ?? "Pool not found."}</p>
        </div>
      </main>
    );
  }

  if (isSuccess) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-moby-100 flex items-center justify-center animate-check-pop">
            <Check className="w-10 h-10 text-moby-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Payment successful!
          </h2>
          <p className="text-slate-600">
            You contributed{" "}
            <span className="font-semibold text-moby-700">
              {formatBYN(pool.share_amount)}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-slate-900">{pool.title}</span>.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-br from-moby-600 to-moby-700 p-6 text-white">
          <div className="flex items-center gap-2 mb-1 opacity-90">
            <Wallet className="w-5 h-5" />
            <span className="text-sm font-medium">Moby Pay</span>
          </div>
          <p className="text-sm opacity-80">Pool</p>
          <h1 className="text-2xl font-bold">{pool.title}</h1>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-moby-50 rounded-2xl p-5 text-center border border-moby-100">
            <p className="text-sm text-moby-700 font-medium mb-1">To pay</p>
            <p className="text-4xl font-extrabold text-moby-800">
              {formatBYN(pool.share_amount)}
            </p>
          </div>

          <form onSubmit={handlePay} className="space-y-5">
            <div>
              <label
                htmlFor="payerName"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Your name
              </label>
              <input
                id="payerName"
                type="text"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                placeholder="e.g. Alex"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-moby-500 focus:ring-2 focus:ring-moby-200 outline-none transition"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isPaying || !payerName.trim()}
              className="w-full flex items-center justify-center gap-2 bg-moby-600 hover:bg-moby-700 disabled:bg-slate-300 text-white font-semibold py-4 rounded-xl transition active:scale-[0.98] shadow-lg shadow-moby-200"
            >
              {isPaying ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CreditCard className="w-5 h-5" />
              )}
              {isPaying
                ? "Processing..."
                : `Pay ${formatBYN(pool.share_amount)} in 1 click (Moby Pay)`}
            </button>
          </form>

          <p className="text-xs text-center text-slate-400">
            This is a demo payment. No real money will be charged.
          </p>
        </div>
      </div>
    </main>
  );
}
