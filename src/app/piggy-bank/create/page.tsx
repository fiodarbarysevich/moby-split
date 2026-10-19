"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { CreateGoalPayload } from "@/types";
import {
  ArrowLeft,
  Calculator,
  ImagePlus,
  Loader2,
  PiggyBank,
  Plus,
  Smile,
  Tag,
} from "lucide-react";

function formatBYN(amount: number): string {
  return `${amount.toFixed(2)} BYN`;
}

export default function CreateGoalPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [childName, setChildName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState<string>("");
  const [partsCount, setPartsCount] = useState<string>("10");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericTarget = useMemo(() => {
    const value = parseFloat(targetAmount);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }, [targetAmount]);

  const numericParts = useMemo(() => {
    const value = parseInt(partsCount, 10);
    return Number.isFinite(value) && value >= 1 ? value : 1;
  }, [partsCount]);

  const partAmount = useMemo(() => {
    if (numericParts === 0) return 0;
    return Math.ceil((numericTarget / numericParts) * 100) / 100;
  }, [numericTarget, numericParts]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError(null);
  }

  async function uploadPhoto(file: File): Promise<{ url: string } | { error: string }> {
    const ext = file.name.split(".").pop() ?? "jpg";
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("goal-photos")
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return { error: uploadError.message };
    }

    const { data } = supabase.storage.from("goal-photos").getPublicUrl(fileName);
    return { url: data.publicUrl };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!childName.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!title.trim()) {
      setError("Please enter a goal title.");
      return;
    }
    if (numericTarget <= 0) {
      setError("Target amount must be greater than 0.");
      return;
    }

    setIsSubmitting(true);

    let photoUrl: string | undefined;
    if (photo) {
      const result = await uploadPhoto(photo);
      if ("error" in result) {
        setError(`Failed to upload photo: ${result.error}`);
        setIsSubmitting(false);
        return;
      }
      photoUrl = result.url;
    }

    const payload: CreateGoalPayload = {
      child_name: childName.trim(),
      title: title.trim(),
      description: description.trim() || undefined,
      target_amount: numericTarget,
      parts_count: numericParts,
      part_amount: partAmount,
      photo_url: photoUrl,
    };

    const { data, error: insertError } = await supabase
      .from("goals")
      .insert(payload)
      .select("id")
      .single();

    setIsSubmitting(false);

    if (insertError || !data) {
      setError(insertError?.message ?? "Failed to create goal.");
      return;
    }

    router.push(`/piggy-bank/goal/${data.id}`);
  }

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="max-w-lg mx-auto">
        <button
          onClick={() => router.push("/piggy-bank")}
          className="flex items-center gap-1 text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
              <PiggyBank className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">New Goal</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Your name
              </label>
              <div className="relative">
                <Smile className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder="e.g. Masha"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-moby-500 focus:ring-2 focus:ring-moby-200 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Goal title
              </label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Lego City"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-moby-500 focus:ring-2 focus:ring-moby-200 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Description (optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Why do you want this?"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-moby-500 focus:ring-2 focus:ring-moby-200 outline-none transition resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Target amount (BYN)
              </label>
              <div className="relative">
                <Calculator className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-moby-500 focus:ring-2 focus:ring-moby-200 outline-none transition"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">
                  BYN
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Number of parts
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={partsCount}
                onChange={(e) => setPartsCount(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-moby-500 focus:ring-2 focus:ring-moby-200 outline-none transition"
              />
            </div>

            <div className="bg-amber-50 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-800 font-medium">Each reward</p>
                <p className="text-3xl font-bold text-amber-900">
                  {formatBYN(partAmount)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                <Calculator className="w-6 h-6" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Photo of the item (optional)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-moby-400 rounded-2xl p-4 transition"
              >
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-16 h-16 object-cover rounded-xl"
                  />
                ) : (
                  <>
                    <ImagePlus className="w-5 h-5 text-slate-400" />
                    <span className="text-slate-500">Tap to add a photo</span>
                  </>
                )}
              </button>
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
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
              {isSubmitting ? "Creating..." : "Create Goal"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
