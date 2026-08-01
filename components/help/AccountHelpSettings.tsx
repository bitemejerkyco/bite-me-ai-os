"use client";

import Link from "next/link";
import HelpModeToggle from "@/components/help/HelpModeToggle";
import { useHelp } from "@/components/help/HelpContext";

export default function AccountHelpSettings() {
  const { preference, setCompactPanels } = useHelp();

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Guidance preferences</p>
      <h2 className="mt-2 text-xl font-black tracking-tight text-slate-900">Help Mode and AI Trainer</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Choose how much instructional UI should appear as you use PostMotive.
      </p>
      <div className="mt-4">
        <HelpModeToggle />
      </div>
      <label className="mt-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        <input type="checkbox" checked={preference.compactPanels} onChange={(event) => void setCompactPanels(event.target.checked)} />
        Keep page help panels compact by default after I am familiar with a page
      </label>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/help" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
          Open Help Center
        </Link>
        <Link href="/academy" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
          Open Academy
        </Link>
      </div>
    </section>
  );
}
