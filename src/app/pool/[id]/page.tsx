"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Payment, Pool } from "@/types";
import { QRCodeSVG } from "qrcode.react";
import confetti from "canvas-confetti";
import {
  CheckCircle,
  Copy,
  Link as LinkIcon,
  Loader2,
  RefreshCw,
  Users,
  Wallet,
} from "lucide-react";

function formatBYN(amount: number): string {
  return `${amount.toFixed(2)} BYN`;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PoolTrackingPage() {
  const params = useParams<{ id: string }>();
  const poolId = params.id;

  const [pool, setPool] = useState<Pool | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  const hasCelebratedRef = useRef(false);

  const payUrl = useMemo(
    () => (origin ? `${origin}/pay/${poolId}` : ""),
    [origin, poolId]
  );

  const { collected, progress, remainingShares } = useMemo(() => {
    if (!pool) {
      return { collected: 0, progress: 0, remainingShares: 0 };
    }
    const collectedSum = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const progress = pool.total_amount > 0
      ? Math.min((collectedSum / pool.total_amount) * 100, 100)
      : 0;
    const remainingShares = Math.max(
      0,
      Math.ceil(((pool.total_amount - collectedSum) / pool.share_amount) * 100) / 100
    );
    return { collected: collectedSum, progress, remainingShares };
  }, [payments, pool]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function fetchPool() {
      setIsLoading(true);
      setError(null);

      const [{ data: poolData, error: poolError }, { data: paymentsData, error: paymentsError }] =
        await Promise.all([
          supabase.from("pools").select("*").eq("id", poolId).single(),
          supabase.from("payments").select("*").eq("pool_id", poolId).order("paid_at", {
            ascending: false,
          }),
        ]);

      if (!isMounted) return;

      if (poolError || paymentsError) {
        setError(poolError?.message ?? paymentsError?.message ?? "Failed to load pool.");
        setIsLoading(false);
        return;
      }

      setPool(poolData as Pool);
      setPayments((paymentsData as Payment[]) ?? []);
      setIsLoading(false);
    }

    fetchPool();

    return () => {
      isMounted = false;
    };
  }, [poolId]);

  useEffect(() => {
    if (!poolId) return;

    const channel = supabase
      .channel(`payments:pool:${poolId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "payments",
          filter: `pool_id=eq.${poolId}`,
        },
        (payload) => {
          const newPayment = payload.new as Payment;
          setPayments((prev) => {
            if (prev.some((p) => p.id === newPayment.id)) return prev;
            return [newPayment, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [poolId]);

  useEffect(() => {
    if (pool && progress >= 100 && !hasCelebratedRef.current) {
      hasCelebratedRef.current = true;
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ["#16a34a", "#22c55e", "#86efac", "#facc15"],
        });
        confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ["#16a34a", "#22c55e", "#86efac", "#facc15"],
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };

      frame();
    }
  }, [pool, progress]);

  async function copyLink() {
    if (!payUrl) return;
    try {
      await navigator.clipboard.writeText(payUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <Loader2 className="w-8 h-8 text-moby-600 animate-spin" />
      </main>
    );
  }

  if (error || !pool) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-6 text-center">
          <p className="text-red-600 mb-4">{error ?? "Pool not found."}</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 text-moby-600 font-medium hover:underline"
          >
            <RefreshCw className="w-4 h-4" />
            Create a new pool
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">
                Pool
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                {pool.title}
              </h1>
            </div>
            <div className="hidden sm:flex w-12 h-12 rounded-full bg-moby-100 items-center justify-center text-moby-600">
              <Wallet className="w-6 h-6" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-sm text-slate-500">Total target</p>
              <p className="text-xl font-bold text-slate-900">
                {formatBYN(pool.total_amount)}
              </p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-sm text-slate-500">Per person</p>
              <p className="text-xl font-bold text-moby-700">
                {formatBYN(pool.share_amount)}
              </p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-sm text-slate-500">Participants</p>
              <p className="text-xl font-bold text-slate-900">
                {payments.length} / {pool.participants_count}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">
                Collected: {formatBYN(collected)} of {formatBYN(pool.total_amount)} (
                {progress.toFixed(0)}%)
              </span>
              {progress >= 100 && (
                <span className="inline-flex items-center gap-1 text-moby-600 font-semibold">
                  <CheckCircle className="w-4 h-4" />
                  Fully funded
                </span>
              )}
            </div>
            <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-moby-500 to-moby-600 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            {remainingShares > 0 && (
              <p className="text-xs text-slate-500">
                ~{remainingShares.toFixed(2)} shares remaining
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 flex flex-col items-center text-center">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-moby-600" />
              Share payment link
            </h2>
            {payUrl && (
              <>
                <div className="bg-white p-3 rounded-2xl shadow-md border border-slate-100 mb-5">
                  <QRCodeSVG value={payUrl} size={180} level="M" includeMargin={false} />
                </div>
                <p className="text-sm text-slate-500 mb-4 break-all">{payUrl}</p>
                <button
                  onClick={copyLink}
                  className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 rounded-xl transition active:scale-[0.98]"
                >
                  {copied ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                  {copied ? "Copied!" : "Copy Link"}
                </button>
              </>
            )}
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-moby-600" />
              Contributors
            </h2>

            {payments.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>No contributions yet.</p>
                <p className="text-sm">Share the QR code to get started.</p>
              </div>
            ) : (
              <ul className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-moby-50 transition"
                  >
                    <div className="w-10 h-10 rounded-full bg-moby-100 text-moby-700 flex items-center justify-center font-bold text-sm shrink-0">
                      {payment.payer_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {payment.payer_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(payment.paid_at)}
                      </p>
                    </div>
                    <span className="font-bold text-moby-700 shrink-0">
                      +{formatBYN(payment.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
