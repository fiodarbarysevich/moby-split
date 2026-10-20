"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { OutgoingCall, OutgoingCallStatus } from "@/types";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Phone,
  PhoneCall,
  PhoneOff,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";

function getRemainingSeconds(target: string): number {
  const diff = new Date(target).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 1000));
}

function formatPhone(phone: string): string {
  return phone.trim();
}

function formatTimer(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function statusBadgeClasses(status: OutgoingCallStatus) {
  switch (status) {
    case "VERIFIED":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "REPORTED_FRAUD":
      return "bg-rose-100 text-rose-700 border-rose-200";
    case "EXPIRED":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-amber-100 text-amber-700 border-amber-200";
  }
}

type CallPhase = "scheduled" | "ringing" | "connected" | "resolved";

export default function SafeCallModal() {
  const pathname = usePathname();
  const [call, setCall] = useState<OutgoingCall | null>(null);
  const [phase, setPhase] = useState<CallPhase>("scheduled");
  const [secondsToCall, setSecondsToCall] = useState(0);
  const [secondsValid, setSecondsValid] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isOperatorPage = pathname?.startsWith("/operator");

  const visible = useMemo(() => {
    if (isOperatorPage) return false;
    if (dismissed) return false;
    if (!call) return false;
    if (call.status === "EXPIRED") return false;
    return true;
  }, [call, dismissed, isOperatorPage]);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => setMounted(true), 10);
      return () => clearTimeout(timer);
    }
    setMounted(false);
  }, [visible]);

  useEffect(() => {
    const channel = supabase
      .channel("safe-call-listener")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "outgoing_calls",
          filter: "status=eq.ACTIVE",
        },
        (payload) => {
          const newCall = payload.new as OutgoingCall;
          setCall(newCall);
          setDismissed(false);
          setPhase("scheduled");
          setSecondsToCall(getRemainingSeconds(newCall.call_starts_at));
          setSecondsValid(getRemainingSeconds(newCall.expires_at));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!call || call.status !== "ACTIVE") return;

    const interval = setInterval(() => {
      const toCall = getRemainingSeconds(call.call_starts_at);
      const valid = getRemainingSeconds(call.expires_at);

      setSecondsToCall(toCall);
      setSecondsValid(valid);

      if (toCall <= 0 && phase === "scheduled") {
        setPhase("ringing");
      }

      if (valid <= 0) {
        clearInterval(interval);
        supabase
          .from("outgoing_calls")
          .update({ status: "EXPIRED" })
          .eq("id", call.id)
          .then(() => {
            setCall((prev) => (prev ? { ...prev, status: "EXPIRED" } : prev));
          });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [call, phase]);

  async function updateStatus(status: OutgoingCallStatus) {
    if (!call) return;
    setIsUpdating(true);

    const { error } = await supabase
      .from("outgoing_calls")
      .update({ status })
      .eq("id", call.id);

    setIsUpdating(false);

    if (error) {
      console.error("Failed to update call status:", error);
      return;
    }

    setCall({ ...call, status });
    setPhase("resolved");

    if (status === "VERIFIED") {
      setTimeout(() => setDismissed(true), 2500);
    }
  }

  function handleAnswer() {
    setPhase("connected");
  }

  function handleDecline() {
    updateStatus("REPORTED_FRAUD");
  }

  if (!visible || !call) return null;

  const isVerified = call.status === "VERIFIED";
  const isReported = call.status === "REPORTED_FRAUD";

  const headerTitle =
    isVerified ? "Call verified" :
    isReported ? "Threat blocked" :
    phase === "scheduled" ? "Secure call scheduled" :
    phase === "ringing" ? "Incoming bank call" :
    "Verify the caller";

  const headerBadge =
    isVerified ? "Verified" :
    isReported ? "Fraud Reported" :
    phase === "scheduled" ? "Code received" :
    phase === "ringing" ? "Incoming call" :
    "On call";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-backdrop-in">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => {}} />

      <div
        className={`relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 ${
          mounted ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-5"
        }`}
      >
        {/* Header */}
        <div className="bg-slate-900 p-6 text-white text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-white/10 mb-4">
            {isVerified ? (
              <ShieldCheck className="w-7 h-7 text-emerald-400" />
            ) : isReported ? (
              <ShieldAlert className="w-7 h-7 text-rose-400" />
            ) : (
              <PhoneCall className="w-7 h-7 text-amber-400" />
            )}
          </div>

          <span
            className={`inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border mb-3 ${statusBadgeClasses(
              call.status
            )}`}
          >
            {headerBadge}
          </span>

          <h2 className="text-xl font-bold">{headerTitle}</h2>
        </div>

        <div className="p-6 space-y-5">
          {/* SCHEDULED: code sent before call */}
          {phase === "scheduled" && (
            <div className="animate-slide-up space-y-5">
              <div className="text-center space-y-1">
                <p className="text-sm text-slate-500">Official bank number</p>
                <p className="text-lg font-semibold text-slate-900">{formatPhone(call.phone_number)}</p>
              </div>

              <div className="text-center">
                <p className="text-sm text-slate-500 mb-2">Your verification code</p>
                <div className="inline-flex items-center justify-center gap-3 bg-slate-100 rounded-2xl px-6 py-4">
                  {call.verification_code.split("").map((digit, index) => (
                    <span
                      key={index}
                      className="text-4xl font-mono font-bold text-slate-900 w-10 h-12 flex items-center justify-center bg-white rounded-lg shadow-sm"
                    >
                      {digit}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  The employee must state this code at the start of the call. If they cannot — hang up immediately.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-slate-600">
                    <Clock className="w-4 h-4" />
                    Call starts in
                  </span>
                  <span className="font-mono font-semibold text-slate-900">{formatTimer(secondsToCall)}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${Math.max(0, Math.min((secondsToCall / 60) * 100, 100))}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-slate-600">
                    <Clock className="w-4 h-4" />
                    Code valid for
                  </span>
                  <span className="font-mono font-semibold text-slate-900">{formatTimer(secondsValid)}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${Math.max(0, Math.min((secondsValid / 180) * 100, 100))}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* RINGING: simulate incoming call */}
          {phase === "ringing" && (
            <div className="animate-slide-up text-center py-2">
              <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5 animate-pulse-ring">
                <Phone className="w-12 h-12 text-emerald-600" />
              </div>
              <p className="text-sm text-slate-500">Incoming call from</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatPhone(call.phone_number)}</p>
              <p className="text-sm text-slate-500 mt-1">Official bank line</p>

              <div className="grid grid-cols-2 gap-4 mt-8">
                <button
                  onClick={handleDecline}
                  disabled={isUpdating}
                  className="flex flex-col items-center justify-center gap-1 bg-rose-100 hover:bg-rose-200 active:scale-95 text-rose-700 font-semibold py-4 rounded-2xl transition"
                >
                  <PhoneOff className="w-6 h-6" />
                  Decline
                </button>
                <button
                  onClick={handleAnswer}
                  disabled={isUpdating}
                  className="flex flex-col items-center justify-center gap-1 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-semibold py-4 rounded-2xl transition"
                >
                  <Phone className="w-6 h-6" />
                  Answer
                </button>
              </div>
            </div>
          )}

          {/* CONNECTED: verify code */}
          {phase === "connected" && (
            <div className="animate-slide-up space-y-5">
              <div className="text-center">
                <p className="text-sm text-slate-500 mb-2">Employee must state this code</p>
                <div className="inline-flex items-center justify-center gap-3 bg-slate-100 rounded-2xl px-6 py-4">
                  {call.verification_code.split("").map((digit, index) => (
                    <span
                      key={index}
                      className="text-4xl font-mono font-bold text-slate-900 w-10 h-12 flex items-center justify-center bg-white rounded-lg shadow-sm"
                    >
                      {digit}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  If the caller states a different code or does not know it — report fraud immediately.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-slate-600">
                    <Clock className="w-4 h-4" />
                    Code valid for
                  </span>
                  <span className="font-mono font-semibold text-slate-900">{formatTimer(secondsValid)}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${Math.max(0, Math.min((secondsValid / 180) * 100, 100))}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => updateStatus("VERIFIED")}
                  disabled={isUpdating}
                  className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 active:scale-[0.98] text-white font-semibold py-3 rounded-xl transition"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Code correct
                </button>
                <button
                  onClick={() => updateStatus("REPORTED_FRAUD")}
                  disabled={isUpdating}
                  className="flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 active:scale-[0.98] text-white font-semibold py-3 rounded-xl transition"
                >
                  <AlertTriangle className="w-5 h-5" />
                  Fake call
                </button>
              </div>
            </div>
          )}

          {/* RESOLVED: verified */}
          {phase === "resolved" && isVerified && (
            <div className="animate-slide-up text-center space-y-3 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-8 h-8 text-emerald-600" />
              </div>
              <p className="text-emerald-800 font-semibold">
                Call verified. You can continue the conversation safely.
              </p>
            </div>
          )}

          {/* RESOLVED: reported */}
          {phase === "resolved" && isReported && (
            <div className="animate-slide-up text-center space-y-3 py-4">
              <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-8 h-8 text-rose-600" />
              </div>
              <p className="text-rose-800 font-semibold">
                Fraud reported. Your card is protected. Hang up immediately.
              </p>
              <button
                onClick={() => setDismissed(true)}
                className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-medium px-5 py-2 rounded-xl transition"
              >
                <X className="w-4 h-4" />
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
