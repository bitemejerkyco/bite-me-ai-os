"use client";

import Link from "next/link";
import { useState } from "react";
import { useHelp } from "@/components/help/HelpContext";

export default function OnboardingChecklist() {
  const { helpContextData, preference } = useHelp();
  const [collapsed, setCollapsed] = useState(false);

  if (preference.helpMode === "OFF") return null;
  if (helpContextData.onboardingPercent >= 100) return null;

  return (
    <section className="rounded-[1.8rem] border border-amber-200 bg-amber-50/80 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Continue setup</p>
          <h2 className="mt-1 text-lg font-black tracking-tight text-slate-900">Onboarding checklist</h2>
          <p className="mt-2 text-sm text-slate-700">Completion: {helpContextData.onboardingPercent}%</p>
        </div>
        <button type="button" onClick={() => setCollapsed((current) => !current)} className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800">
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </div>
      {!collapsed ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/help" className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100">
            Continue setup
          </Link>
          <Link href="/onboarding" className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400">
            Business Setup
          </Link>
        </div>
      ) : null}
    </section>
  );
}
