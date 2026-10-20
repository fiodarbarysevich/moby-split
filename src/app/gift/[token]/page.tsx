"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AllowanceRule, ChildWallet, GiftLink, Goal } from "@/types";
import confetti from "canvas-confetti";
import {
  Check,
  Gift,
  Heart,
  Loader2,
  MessageSquare,
  PiggyBank,
  Sparkles,
  User,
  Wallet,
} from "lucide-react";

function formatBYN(amount: number): string {
  return `${amount.toFixed(2)} BYN`;
}

export default function GiftPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [giftLink, setGiftLink] = useState<GiftLink | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [wallets, setWallets] = useState<ChildWallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [senderName, setSenderName] = useState("");
  const [amount, setAmount] = useState<string>("10");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      setIsLoading(true);
      setError(null);

      const { data: linkData, error: linkError } = await supabase
        .from("gift_links")
        .select("*")
        .eq("token", token)
        .single();

      if (!isMounted) return;

      if (linkError || !linkData) {
        setError(linkError?.message ?? "Gift link not found.");
        setIsLoading(false);
        return;
      }

      const link = linkData as GiftLink;
      setGiftLink(link);

      const promises: PromiseLike<void>[] = [];

      if (link.goal_id) {
        promises.push(
          supabase
            .from("goals")
            .select("*")
            .eq("id", link.goal_id)
            .single()
            .then(({ data }) => {
              if (data) setGoal(data as Goal);
            })
        );
      }

      promises.push(
        supabase
          .from("child_wallets")
          .select("*")
          .eq("child_name", link.child_name)
          .then(({ data }) => {
            if (data) setWallets(data as ChildWallet[]);
          })
      );

      await Promise.allSettled(promises);

      if (!isMounted) return;
      setIsLoading(false);
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const numericAmount = useMemo(() => {
    const value = parseFloat(amount);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }, [amount]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!giftLink || numericAmount <= 0 || !senderName.trim()) return;

    setIsSubmitting(true);

    const { error: giftError } = await (supabase.from("gifts") as any).insert({
      gift_link_id: giftLink.id,
      child_name: giftLink.child_name,
      goal_id: giftLink.goal_id,
      sender_name: senderName.trim(),
      amount: numericAmount,
      message: message.trim() || null,
    });

    if (giftError) {
      setError(giftError.message);
      setIsSubmitting(false);
      return;
    }

    const { data: ruleData } = await supabase
      .from("allowance_rules")
      .select("*")
      .eq("child_name", giftLink.child_name)
      .single();
    const rule = ruleData as AllowanceRule | null;

    if (rule?.auto_split_all) {
      const spendAmount = Math.floor(numericAmount * (rule.spend_percent / 100) * 100) / 100;
      const saveAmount = Math.floor(numericAmount * (rule.save_percent / 100) * 100) / 100;
      const giveAmount = Math.round((numericAmount - spendAmount - saveAmount) * 100) / 100;

      for (const [type, delta] of [
        ["spend", spendAmount],
        ["save", saveAmount],
        ["give", giveAmount],
      ] as ["spend" | "save" | "give", number][]) {
        const wallet = wallets.find((w) => w.wallet_type === type);
        if (wallet) {
          await (supabase.from("child_wallets") as any)
            .update({ balance: wallet.balance + delta, updated_at: new Date().toISOString() })
            .eq("id", wallet.id);
        } else {
          await (supabase.from("child_wallets") as any).insert({
            child_name: giftLink.child_name,
            wallet_type: type,
            balance: delta,
          });
        }
      }
    } else {
      const saveWallet = wallets.find((w) => w.wallet_type === "save");
      if (saveWallet) {
        await (supabase.from("child_wallets") as any)
          .update({ balance: saveWallet.balance + numericAmount, updated_at: new Date().toISOString() })
          .eq("id", saveWallet.id);
      } else {
        await (supabase.from("child_wallets") as any).insert({
          child_name: giftLink.child_name,
          wallet_type: "save",
          balance: numericAmount,
        });
      }
    }

    if (goal) {
      await (supabase.from("goal_contributions") as any).insert({
        goal_id: goal.id,
        amount: numericAmount,
      });
    }

    setIsSubmitting(false);
    setIsSuccess(true);

    confetti({
      particleCount: 80,
      spread: 90,
      origin: { y: 0.6 },
      colors: ["#f59e0b", "#fbbf24", "#22c55e", "#ec4899"],
    });
  }

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
      </main>
    );
  }

  if (error || !giftLink) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-lg p-6 text-center">
          <p className="text-red-600">{error ?? "Gift link not found."}</p>
        </div>
      </main>
    );
  }

  if (isSuccess) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-rose-50">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center animate-check-pop">
            <Check className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Gift sent!</h2>
          <p className="text-slate-600">
            You contributed <span className="font-semibold text-emerald-700">{formatBYN(numericAmount)}</span> to{" "}
            <span className="font-semibold text-slate-900">{giftLink.child_name}</span>.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-rose-50">
      <div className="w-full max-w-md">
        <div className="bg-gradient-to-br from-rose-400 to-pink-500 rounded-3xl shadow-xl p-6 text-white text-center mb-6">
          <Gift className="w-10 h-10 mx-auto mb-3" />
          <h1 className="text-2xl font-bold">A gift for {giftLink.child_name}</h1>
          <p className="opacity-90">Send money to their piggy bank</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6 space-y-5">
          {goal && (
            <div className="bg-amber-50 rounded-2xl p-4 flex items-center gap-3">
              <PiggyBank className="w-6 h-6 text-amber-600" />
              <div>
                <p className="text-sm text-amber-700">Towards goal</p>
                <p className="font-bold text-amber-900">{goal.title}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Your name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="e.g. Grandma"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Amount (BYN)</label>
              <div className="relative">
                <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none transition"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">BYN</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Message (optional)</label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Happy birthday! 🎉"
                  rows={3}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 outline-none transition resize-none"
                />
              </div>
            </div>

            {message && (
              <div className="bg-rose-50 border-2 border-dashed border-rose-200 rounded-2xl p-4 text-center">
                <Heart className="w-5 h-5 mx-auto text-rose-500 mb-2" />
                <p className="text-rose-800 italic">&ldquo;{message}&rdquo;</p>
                <p className="text-sm text-rose-600 mt-1">— {senderName || "You"}</p>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || numericAmount <= 0 || !senderName.trim()}
              className="w-full flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 disabled:bg-slate-300 text-white font-semibold py-4 rounded-xl transition active:scale-[0.98]"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
              {isSubmitting ? "Sending..." : `Gift ${formatBYN(numericAmount)}`}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
