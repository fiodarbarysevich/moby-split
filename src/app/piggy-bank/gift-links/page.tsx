"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { GiftLink } from "@/types";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Copy, Gift, Loader2, Plus, QrCode, Trash2, User } from "lucide-react";

function formatBYN(amount: number): string {
  return `${amount.toFixed(2)} BYN`;
}

export default function GiftLinksPage() {
  const router = useRouter();
  const [childName, setChildName] = useState("");
  const [origin, setOrigin] = useState("");
  const [links, setLinks] = useState<GiftLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function loadLinks(name: string) {
    if (!name.trim()) {
      setLinks([]);
      return;
    }
    setIsLoading(true);
    const { data, error: fetchError } = await supabase
      .from("gift_links")
      .select("*")
      .eq("child_name", name.trim())
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setLinks((data as GiftLink[]) ?? []);
      setError(null);
    }
    setIsLoading(false);
  }

  async function createLink() {
    if (!childName.trim()) return;
    setIsCreating(true);
    const { data, error: insertError } = await supabase
      .from("gift_links")
      .insert({ child_name: childName.trim() })
      .select("*")
      .single();

    setIsCreating(false);

    if (insertError || !data) {
      setError(insertError?.message ?? "Failed to create gift link.");
      return;
    }

    setLinks((prev) => [data as GiftLink, ...prev]);
  }

  async function deleteLink(id: string) {
    const { error: deleteError } = await supabase.from("gift_links").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  async function copyLink(url: string, token: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      setCopiedToken(null);
    }
  }

  function linkUrl(token: string) {
    return `${origin}/gift/${token}`;
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 bg-slate-50">
      <div className="max-w-xl mx-auto space-y-6">
        <button
          onClick={() => router.push("/piggy-bank")}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Piggy Bank
        </button>

        <div className="bg-gradient-to-br from-rose-500 to-rose-600 rounded-3xl shadow-xl p-6 sm:p-8 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <Gift className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Gift Links</h1>
              <p className="text-rose-100">Create links and QR codes for relatives</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-lg p-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
              <User className="w-4 h-4" />
              Child name
            </span>
            <input
              type="text"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="e.g. Masha"
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </label>

          <div className="flex gap-3">
            <button
              onClick={() => loadLinks(childName)}
              disabled={isLoading || !childName.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-900 font-medium px-4 py-3 rounded-xl transition"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
              {isLoading ? "Loading..." : "Find existing links"}
            </button>
            <button
              onClick={createLink}
              disabled={isCreating || !childName.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white font-medium px-4 py-3 rounded-xl transition"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {isCreating ? "Creating..." : "Create gift link"}
            </button>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{error}</p>}
        </div>

        {links.length > 0 && (
          <div className="space-y-4">
            <h2 className="font-bold text-slate-900 px-1">Generated links</h2>
            {links.map((link) => {
              const url = linkUrl(link.token);
              return (
                <div key={link.id} className="bg-white rounded-3xl shadow-lg p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500">
                      For <span className="font-semibold text-slate-900">{link.child_name}</span>
                    </p>
                    <button
                      onClick={() => deleteLink(link.id)}
                      className="text-slate-400 hover:text-red-600 transition"
                      title="Delete link"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex justify-center bg-slate-50 rounded-2xl p-4">
                    <QRCodeSVG value={url} size={180} level="M" />
                  </div>

                  <p className="text-xs text-slate-500 break-all bg-slate-50 rounded-xl p-3">{url}</p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => copyLink(url, link.token)}
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium px-4 py-2 rounded-xl transition"
                    >
                      <Copy className="w-4 h-4" />
                      {copiedToken === link.token ? "Copied!" : "Copy link"}
                    </button>
                    <button
                      onClick={() => router.push(`/gift/${link.token}`)}
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 text-white font-medium px-4 py-2 rounded-xl transition"
                    >
                      <Gift className="w-4 h-4" />
                      Open
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
