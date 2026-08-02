"use client";

import { useEffect, useState } from "react";
import {
  demoWorkspace,
  isDemoMode,
  type Industry,
  type WorkspaceProfile,
} from "@/features/core/local-os";
import {
  loadCloudWorkspace,
  saveCloudWorkspace,
} from "@/features/core/cloud-store";
import { SUCCESS_MESSAGES } from "@/features/help/success-messages";

const empty: WorkspaceProfile = {
  businessName: "",
  website: "",
  industry: "GENERAL_RETAIL",
  primaryGoal: "",
  audience: "",
  voice: "",
  completedAt: "",
};

export default function OnboardingWorkspace() {
  const [profile, setProfile] = useState(empty);
  const [saved, setSaved] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void loadCloudWorkspace()
        .then((cloud) => {
          if (cloud) {
            setProfile(cloud);
            return;
          }
          if (isDemoMode()) {
            setProfile(demoWorkspace());
            return;
          }
          setProfile(empty);
        })
        .catch(() => setProfile(isDemoMode() ? demoWorkspace() : empty));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const update = (field: keyof WorkspaceProfile, value: string) => {
    setSaved(false);
    setProfile((previous) => ({ ...previous, [field]: value }));
  };

  const save = async (
    nextProfile: WorkspaceProfile = profile,
    continueToStudio = true,
  ) => {
    setSaving(true);
    setError("");
    setSuccessMessage("");
    try {
      const completed = {
        ...nextProfile,
        completedAt: nextProfile.completedAt || new Date().toISOString(),
      };
      const cloud = await saveCloudWorkspace(completed);
      setProfile(cloud);
      setSaved(true);
      const success = SUCCESS_MESSAGES.businessProfileSaved();
      setSuccessMessage(`${success.title}. ${success.detail}`);
      if (continueToStudio) {
        window.location.assign("/studio");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save setup.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 md:p-7">
        <h2 className="text-xl font-bold">Business profile</h2>
        <p className="mt-1 text-sm text-slate-500">This controls brand voice, recommendations, and compliance checks.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[
            ["businessName", "Business name", "Bite Me Jerky"],
            ["website", "Website", "https://welikejerky.com"],
            ["primaryGoal", "Primary goal", "Increase online sales"],
            ["audience", "Primary audience", "Adventure riders and snack buyers"],
            ["voice", "Brand voice", "Bold, witty, confident"],
          ].map(([field, label, placeholder]) => (
            <label key={field} className={field === "primaryGoal" ? "md:col-span-2" : ""}>
              <span className="text-sm text-slate-700">{label}</span>
              <input
                value={profile[field as keyof WorkspaceProfile]}
                onChange={(event) => update(field as keyof WorkspaceProfile, event.target.value)}
                placeholder={placeholder}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
              />
            </label>
          ))}
          <label className="md:col-span-2">
            <span className="text-sm text-slate-700">Industry / Compliance Mode</span>
            <select
              value={profile.industry}
              onChange={(event) => update("industry", event.target.value as Industry)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
            >
              <option value="GENERAL_RETAIL">General Retail</option>
              <option value="FOOD_BEVERAGE">Food & Beverage</option>
              <option value="CANNABIS">Cannabis</option>
              <option value="CBD">CBD</option>
              <option value="ALCOHOL">Alcohol</option>
              <option value="HEALTHCARE">Healthcare</option>
              <option value="FINANCIAL_SERVICES">Financial Services</option>
              <option value="SUPPLEMENTS">Supplements</option>
            </select>
          </label>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button disabled={saving} onClick={() => void save()} className="rounded-xl bg-violet-600 px-5 py-2.5 font-semibold text-white hover:bg-violet-500 disabled:opacity-60">
            {saving ? "Saving securely…" : "Save & create content →"}
          </button>
          <button
            disabled={saving}
            onClick={() => {
              const demo = demoWorkspace();
              setProfile(demo);
              void save(demo);
            }}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-slate-700 hover:bg-violet-50"
          >
            Use demo & continue
          </button>
        </div>
        {saved ? <p className="mt-3 text-sm text-emerald-700">{successMessage || "Business profile saved."}</p> : null}
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </section>
      <aside className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-5">
        <h3 className="font-bold text-amber-800">Compliance Mode</h3>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Content guidance changes by industry. Restricted industries receive safer channel recommendations,
          claim warnings, and alternatives when direct promotion may violate platform policy.
        </p>
      </aside>
    </div>
  );
}
