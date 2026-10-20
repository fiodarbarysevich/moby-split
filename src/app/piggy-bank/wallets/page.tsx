"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AllowanceRule, AllowanceTransaction, ChildWallet, Gift, WalletType } from "@/types";
import confetti from "canvas-confetti";
import {
  ArrowLeft,
  Gift as GiftIcon,
  HandHeart,
  Landmark,
  Loader2,
  PiggyBank,
  Plus,
  Settings,
  ShoppingBag,
  Smile,
  Sparkles,
  User,
} from "lucide-react";

function formatBYN(amount: number): string {
  return `${amount.toFixed(2)} BYN`;
}

function walletIcon(type: WalletType) {
  switch (type) {
    case "spend":
      return <ShoppingBag className="w-6 h-6" />;
    case "save":
      return <PiggyBank className="w-6 h-6" />;
    case "give":
      return <HandHeart className="w-6 h-6" />;
  }
}

function walletLabel(type: WalletType) {
  switch (type) {
    case "spend":
      return "Spend";
    case "save":
      return "Save";
    case "give":
      return "Give";
  }
}

function walletColor(type: WalletType) {
  switch (type) {
    case "spend":
      return "bg-blue-500";
    case "save":
      return "bg-amber-500";
    case "give":
      return "bg-rose-500";
  }
}

function walletBg(type: WalletType) {
  switch (type) {
    case "spend":
      return "bg-blue-50 text-blue-700";
    case "save":
      return "bg-amber-50 text-amber-700";
    case "give":
      return "bg-rose-50 text-rose-700";
  }
}

export default function WalletsPage() {
  const router = useRouter();
  const [childName, setChildName] = useState("Masha");
  const [wallets, setWallets] = useState<ChildWallet[]>([]);
  const [rule, setRule] = useState<AllowanceRule | null>(null);
  const [transactions, setTransactions] = useState<AllowanceTransaction[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      setIsLoading(true);

      const [
        { data: walletsData },
        { data: ruleData },
        { data: transactionsData },
        { data: giftsData },
      ] = await Promise.all([
        supabase.from("child_wallets").select("*").eq("child_name", childName),
        supabase.from("allowance_rules").select("*").eq("child_name", childName).single(),
        supabase
          .from("allowance_transactions")
          .select("*")
          .eq("child_name", childName)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("gifts").select("*").eq("child_name", childName).order("created_at", { ascending: false }).limit(5),
      ]);

      if (!isMounted) return;

      setWallets((walletsData as ChildWallet[]) ?? []);
      setRule((ruleData as AllowanceRule) ?? null);
      setTransactions((transactionsData as AllowanceTransaction[]) ?? []);
      setGifts((giftsData as Gift[]) ?? []);
      setIsLoading(false);
    }

    fetchData();

    const walletsChannel = supabase
      .channel(`wallets:${childName}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "child_wallets", filter: `child_name=eq.${childName}` },
        () => fetchData()
      )
      .subscribe();

    const giftsChannel = supabase
      .channel(`gifts:${childName}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gifts", filter: `child_name=eq.${childName}` },
        () => {
          fetchData();
          confetti({
            particleCount: 60,
            spread: 70,
            origin: { y: 0.6 },
            colors: ["#f59e0b", "#fbbf24", "#22c55e", "#ef4444"],
          });
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(walletsChannel);
      supabase.removeChannel(giftsChannel);
    };
  }, [childName]);

  const walletMap = useMemo(() => {
    const map: Partial<Record<WalletType, ChildWallet>> = {};
    for (const wallet of wallets) {
      map[wallet.wallet_type] = wallet;
    }
    return map;
  }, [wallets]);

  async function handlePayAllowance() {
    if (!rule) return;
    setIsPaying(true);

    const amount = rule.amount;
    const spendAmount = Math.floor(amount * (rule.spend_percent / 100) * 100) / 100;
    const saveAmount = Math.floor(amount * (rule.save_percent / 100) * 100) / 100;
    const giveAmount = Math.round((amount - spendAmount - saveAmount) * 100) / 100;

    const { error: transactionError } = await supabase.from("allowance_transactions").insert({
      child_name: childName,
      amount,
      spend_amount: spendAmount,
      save_amount: saveAmount,
      give_amount: giveAmount,
    });

    if (transactionError) {
      setIsPaying(false);
      console.error(transactionError);
      return;
    }

    for (const [type, delta] of [
      ["spend", spendAmount],
      ["save", saveAmount],
      ["give", giveAmount],
    ] as [WalletType, number][]) {
      const existing = wallets.find((w) => w.wallet_type === type);
      if (existing) {
        await supabase
          .from("child_wallets")
          .update({ balance: existing.balance + delta, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("child_wallets").insert({
          child_name: childName,
          wallet_type: type,
          balance: delta,
        });
      }
    }

    setIsPaying(false);

    const { data } = await supabase.from("child_wallets").select("*").eq("child_name", childName);
    setWallets((data as ChildWallet[]) ?? []);

    const { data: txData } = await supabase
      .from("allowance_transactions")
      .select("*")
      .eq("child_name", childName)
      .order("created_at", { ascending: false })
      .limit(5);
    setTransactions((txData as AllowanceTransaction[]) ?? []);

    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.7 },
      colors: ["#f59e0b", "#fbbf24", "#22c55e"],
    });
  }

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <button
          onClick={() => router.push("/piggy-bank")}
          className="flex items-center gap-1 text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="bg-gradient-to-br from-emerald-400 to-teal-500 rounded-3xl shadow-xl p-6 sm:p-8 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <Landmark className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">My Wallets</h1>
              <p className="opacity-90">Spend, Save, Give</p>
            </div>
          </div>

          <div className="bg-white/10 rounded-2xl p-4 flex items-center gap-3">
            <User className="w-5 h-5 opacity-80" />
            <input
              type="text"
              value={childName}
              onChange={(e) => setChildName(e.target.value.trim())}
              placeholder="Your name"
              className="bg-transparent border-b border-white/30 focus:border-white outline-none text-white placeholder-white/60 flex-1 py-1"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-moby-600 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(["spend", "save", "give"] as WalletType[]).map((type) => (
                <div key={type} className={`rounded-2xl shadow-lg p-5 ${walletBg(type)}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-full bg-white/50 flex items-center justify-center`}>
                      {walletIcon(type)}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wide opacity-70">{walletLabel(type)}</span>
                  </div>
                  <p className="text-2xl font-bold">{formatBYN(walletMap[type]?.balance ?? 0)}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push("/piggy-bank/wallets/setup")}
                className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-900 font-semibold px-4 py-3 rounded-xl shadow-lg border border-slate-100 transition active:scale-[0.98]"
              >
                <Settings className="w-5 h-5" />
                {rule ? "Edit rule" : "Set up allowance"}
              </button>

              {rule && (
                <button
                  onClick={handlePayAllowance}
                  disabled={isPaying}
                  className="flex items-center gap-2 bg-moby-600 hover:bg-moby-700 disabled:bg-slate-300 text-white font-semibold px-4 py-3 rounded-xl shadow-lg transition active:scale-[0.98]"
                >
                  {isPaying ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Sparkles className="w-5 h-5" />
                  )}
                  {isPaying ? "Paying..." : "Pay allowance now"}
                </button>
              )}

            </div>

            {rule && (
              <div className="bg-white rounded-3xl shadow-lg p-5">
                <h3 className="font-bold text-slate-900 mb-2">Allowance rule</h3>
                <p className="text-slate-600">
                  {formatBYN(rule.amount)} weekly → Spend {rule.spend_percent}% / Save {rule.save_percent}% / Give{" "}
                  {rule.give_percent}%
                </p>
              </div>
            )}

            {!rule && (
              <div className="bg-white rounded-3xl shadow-lg p-8 text-center">
                <Smile className="w-12 h-12 mx-auto text-amber-400 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">No allowance rule yet</h3>
                <p className="text-slate-500 mb-4">Set up weekly pocket money to start learning financial discipline.</p>
                <button
                  onClick={() => router.push("/piggy-bank/wallets/setup")}
                  className="inline-flex items-center gap-2 bg-moby-600 hover:bg-moby-700 text-white font-semibold px-6 py-3 rounded-xl transition"
                >
                  <Plus className="w-5 h-5" />
                  Set up allowance
                </button>
              </div>
            )}

            {(transactions.length > 0 || gifts.length > 0) && (
              <div className="bg-white rounded-3xl shadow-lg p-6">
                <h3 className="font-bold text-slate-900 mb-4">Recent activity</h3>
                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-moby-100 text-moby-600 flex items-center justify-center">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">Allowance paid</p>
                          <p className="text-xs text-slate-500">
                            +{formatBYN(tx.spend_amount)} spend / +{formatBYN(tx.save_amount)} save / +{formatBYN(tx.give_amount)} give
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-moby-700">+{formatBYN(tx.amount)}</span>
                    </div>
                  ))}

                  {gifts.map((gift) => (
                    <div key={gift.id} className="flex items-center justify-between p-3 rounded-xl bg-rose-50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                          <GiftIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">Gift from {gift.sender_name}</p>
                          <p className="text-xs text-slate-500">{gift.message || "No message"}</p>
                        </div>
                      </div>
                      <span className="font-bold text-rose-700">+{formatBYN(gift.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
