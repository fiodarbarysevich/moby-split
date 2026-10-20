"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { OutgoingCall, OutgoingCallStatus } from "@/types";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  PhoneCall,
  Shield,
} from "lucide-react";

function getRemainingSeconds(target: string): number {
  const diff = new Date(target).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 1000));
}

function validatePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7;
}

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "+";
  if (digits.length <= 3) return `+${digits}`;
  if (digits.length <= 5) return `+${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length <= 8) return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5)}`;
  if (digits.length <= 10)
    return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)}-${digits.slice(8)}`;
  return `+${digits.slice(0, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 8)}-${digits.slice(
    8,
    10
  )}-${digits.slice(10, 12)}`;
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

function statusLabel(status: OutgoingCallStatus) {
  switch (status) {
    case "VERIFIED":
      return "Verified by client";
    case "REPORTED_FRAUD":
      return "Fraud reported";
    case "EXPIRED":
      return "Expired";
    default:
      return "Waiting for client";
  }
}

export default function OperatorPortalPage() {
  const [clientPhone, setClientPhone] = useState("+375 29 123-45-67");
  const [isInitiating, setIsInitiating] = useState(false);
  const [activeCall, setActiveCall] = useState<OutgoingCall | null>(null);
  const [secondsToCall, setSecondsToCall] = useState(0);
  const [secondsValid, setSecondsValid] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isPhoneValid = useMemo(() => validatePhone(clientPhone), [clientPhone]);

  useEffect(() => {
    if (!activeCall) return;

    const interval = setInterval(() => {
      const toCall = getRemainingSeconds(activeCall.call_starts_at);
      const valid = getRemainingSeconds(activeCall.expires_at);

      setSecondsToCall(toCall);
      setSecondsValid(valid);

      if (toCall <= 0 && activeCall.status === "ACTIVE" && valid > 0) {
        // Call window is active; nothing to auto-update here.
      }

      if (valid <= 0 && activeCall.status === "ACTIVE") {
        clearInterval(interval);
        supabase
          .from("outgoing_calls")
          .update({ status: "EXPIRED" })
          .eq("id", activeCall.id)
          .then(() => {
            setActiveCall((prev) => (prev ? { ...prev, status: "EXPIRED" } : prev));
          });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCall]);

  useEffect(() => {
    if (!activeCall) return;

    const channel = supabase
      .channel(`operator-call:${activeCall.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "outgoing_calls",
          filter: `id=eq.${activeCall.id}`,
        },
        (payload) => {
          setActiveCall(payload.new as OutgoingCall);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeCall?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleInitiate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isPhoneValid) {
      setError("Please enter a valid phone number.");
      return;
    }

    setIsInitiating(true);

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const callStartsAt = new Date(Date.now() + 60_000).toISOString();
    const expiresAt = new Date(Date.now() + 180_000).toISOString();

    const { data, error: insertError } = await supabase
      .from("outgoing_calls")
      .insert({
        phone_number: clientPhone.trim(),
        verification_code: code,
        status: "ACTIVE",
        call_starts_at: callStartsAt,
        expires_at: expiresAt,
      })
      .select("*")
      .single();

    setIsInitiating(false);

    if (insertError || !data) {
      setError(insertError?.message ?? "Failed to initiate call.");
      return;
    }

    const call = data as OutgoingCall;
    setActiveCall(call);
    setSecondsToCall(getRemainingSeconds(call.call_starts_at));
    setSecondsValid(getRemainingSeconds(call.expires_at));
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-slate-100">
      <div className="w-full max-w-lg space-y-6">
        <div className="bg-slate-900 rounded-3xl shadow-xl p-6 sm:p-8 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Banker Portal</h1>
              <p className="text-sm opacity-80">Outgoing secure-call verification</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8">
          <form onSubmit={handleInitiate} className="space-y-5">
            <div>
              <label
                htmlFor="clientPhone"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Client phone number
              </label>
              <div className="relative">
                <PhoneCall className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  id="clientPhone"
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(formatPhoneInput(e.target.value))}
                  placeholder="+375 29 123-45-67"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 outline-none transition font-mono"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
            )}

            <button
              type="submit"
              disabled={isInitiating || !isPhoneValid}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold py-4 rounded-xl transition active:scale-[0.98]"
            >
              {isInitiating ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <PhoneCall className="w-5 h-5" />
              )}
              {isInitiating ? "Scheduling..." : "Schedule Secure Call"}
            </button>
          </form>
        </div>

        {activeCall && (
          <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900">Active Session</h2>
              <span
                className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${statusBadgeClasses(
                  activeCall.status
                )}`}
              >
                {statusLabel(activeCall.status)}
              </span>
            </div>

            <div className="text-center mb-6">
              <p className="text-sm text-slate-500 mb-2">Verification code sent to client</p>
              <div className="inline-flex items-center justify-center gap-3 bg-slate-100 rounded-2xl px-6 py-5">
                {activeCall.verification_code.split("").map((digit, index) => (
                  <span
                    key={index}
                    className="text-5xl font-mono font-bold text-slate-900 w-12 h-14 flex items-center justify-center bg-white rounded-lg shadow-sm"
                  >
                    {digit}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-slate-600">
                    <Clock className="w-4 h-4" />
                    Call starts in
                  </span>
                  <span className="font-mono font-semibold text-slate-900">
                    {Math.floor(secondsToCall / 60)}:
                    {String(secondsToCall % 60).padStart(2, "0")}
                  </span>
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
                  <span className="font-mono font-semibold text-slate-900">
                    {Math.floor(secondsValid / 60)}:
                    {String(secondsValid % 60).padStart(2, "0")}
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                      activeCall.status === "VERIFIED"
                        ? "bg-emerald-500"
                        : activeCall.status === "REPORTED_FRAUD"
                        ? "bg-rose-500"
                        : "bg-amber-500"
                    }`}
                    style={{
                      width: `${Math.max(0, Math.min((secondsValid / 180) * 100, 100))}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {activeCall.status === "VERIFIED" && (
              <div className="flex items-center gap-3 text-emerald-700 bg-emerald-50 rounded-xl p-4">
                <CheckCircle2 className="w-6 h-6" />
                <p className="font-semibold">Client confirmed the code. Call is verified.</p>
              </div>
            )}

            {activeCall.status === "REPORTED_FRAUD" && (
              <div className="flex items-center gap-3 text-rose-700 bg-rose-50 rounded-xl p-4">
                <AlertTriangle className="w-6 h-6" />
                <p className="font-semibold">Client reported fraud. End the call immediately.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
