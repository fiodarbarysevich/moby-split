"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AllowanceRule, WalletType } from "@/types";
import { ArrowLeft, Calculator, HandHeart, Landmark, PiggyBank, Save, ShoppingBag, Split } from "lucide-react";

function formatBYN(amount: number): string {
  return `${amount.toFixed(2)} BYN`;
}

function walletIcon(type: WalletType) {
  switch (type) {
    case "spend":
      return <ShoppingBag className="w-5 h-5" />;
    case "save":
      return <PiggyBank className="w-5 h-5" />;
    case "give":
      return <HandHeart className="w-5 h-5" />;
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

export default function WalletsSetupPage() {
  const router = useRouter();
  const [childName, setChildName] = useState("Masha");
  const [amount, setAmount] = useState<string>("20");
  const [spendPercent, setSpendPercent] = useState<string>("50");
  const [savePercent, setSavePercent] = useState<string>("40");
  const [givePercent, setGivePercent] = useState<string>("10");
  const [autoSplitAll, setAutoSplitAll] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchRule() {
      const { data } = await supabase
        .from("allowance_rules")
        .select("*")
        .eq("child_name", childName)
        .single();

      if (!isMounted || !data) return;

      const rule = data as AllowanceRule;
      setAmount(rule.amount.toString());
      setSpendPercent(rule.spend_percent.toString());
      setSavePercent(rule.save_percent.toString());
      setGivePercent(rule.give_percent.toString());
      setAutoSplitAll(rule.auto_split_all);
    }

    fetchRule();

    return () => {
      isMounted = false;
    };
  }, [childName]);

  const numericAmount = useMemo(() => {
    const value = parseFloat(amount);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }, [amount]);

  const numericSpend = useMemo(() => {
    const value = parseInt(spendPercent, 10);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }, [spendPercent]);

  const numericSave = useMemo(() => {
    const value = parseInt(savePercent, 10);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }, [savePercent]);

  const numericGive = useMemo(() => {
    const value = parseInt(givePercent, 10);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }, [givePercent]);

  const totalPercent = numericSpend + numericSave + numericGive;
  const isValid = totalPercent === 100;

  const amounts = useMemo(() => {
    const spend = Math.floor(numericAmount * (numericSpend / 100) * 100) / 100;
    const save = Math.floor(numericAmount * (numericSave / 100) * 100) / 100;
    const give = Math.round((numericAmount - spend - save) * 100) / 100;
    return { spend, save, give };
  }, [numericAmount, numericSpend, numericSave]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!childName.trim()) {
      setError("Please enter the child's name.");
      return;
    }
    if (numericAmount <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }
    if (!isValid) {
      setError(`Percentages must add up to 100%. Current: ${totalPercent}%`);
      return;
    }

    setIsSubmitting(true);

    const { error: upsertError } = await supabase.from("allowance_rules").upsert(
      {
        child_name: childName.trim(),
        amount: numericAmount,
        frequency: "weekly",
        spend_percent: numericSpend,
        save_percent: numericSave,
        give_percent: numericGive,
        auto_split_all: autoSplitAll,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "child_name" }
    );

    if (upsertError) {
      setError(upsertError.message);
      setIsSubmitting(false);
      return;
    }

    for (const type of ["spend", "save", "give"] as WalletType[]) {
      const { data: existing } = await supabase
        .from("child_wallets")
        .select("id")
        .eq("child_name", childName.trim())
        .eq("wallet_type", type)
        .single();

      if (!existing) {
        await supabase.from("child_wallets").insert({
          child_name: childName.trim(),
          wallet_type: type,
          balance: 0,
        });
      }
    }

    setIsSubmitting(false);
    router.push("/piggy-bank/wallets");
  }

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="max-w-lg mx-auto">
        <button
          onClick={() => router.push("/piggy-bank/wallets")}
          className="flex items-center gap-1 text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Landmark className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Allowance Rule</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Child name</label>
              <input
                type="text"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="e.g. Masha"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Weekly amount (BYN)</label>
              <div className="relative">
                <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">BYN</span>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium text-slate-900">Distribution</h3>

              {([
                ["spend", spendPercent, setSpendPercent],
                ["save", savePercent, setSavePercent],
                ["give", givePercent, setGivePercent],
              ] as [WalletType, string, (v: string) => void][]).map(([type, value, setValue]) => (
                <div key={type} className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${walletColor(type)} text-white flex items-center justify-center shrink-0`}>
                    {walletIcon(type)}
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700">{walletLabel(type)}</label>
                    <p className="text-xs text-slate-500">{formatBYN(amounts[type])}</p>
                  </div>
                  <div className="relative w-24">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition text-right"
                    />
                    <span className="absolute right-8 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
                  </div>
                </div>
              ))}
            </div>

            <div className={`rounded-2xl p-4 text-center ${isValid ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
              <p className="text-sm font-medium">Total: {totalPercent}%</p>
              {!isValid && <p className="text-xs mt-1">Percentages must add up to 100%</p>}
            </div>

            <div className="bg-slate-50 rounded-2xl p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSplitAll}
                  onChange={(e) => setAutoSplitAll(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <div className="flex items-center gap-2 font-medium text-slate-900">
                    <Split className="w-4 h-4" />
                    Auto-split all incoming money
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    Gifts from grandparents and other incoming money will also be split into Spend / Save / Give using these percentages.
                  </p>
                </div>
              </label>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !isValid}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold py-4 rounded-xl transition active:scale-[0.98]"
            >
              <Save className="w-5 h-5" />
              {isSubmitting ? "Saving..." : "Save rule"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
