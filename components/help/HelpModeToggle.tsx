"use client";

import type { HelpMode } from "@/features/help/types";
import { useHelp } from "@/components/help/HelpContext";

const OPTIONS: HelpMode[] = ["ON", "AUTO", "OFF"];

export default function HelpModeToggle() {
  const { preference, setHelpMode } = useHelp();

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white p-1">
      {OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => void setHelpMode(option)}
          aria-pressed={preference.helpMode === option}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${preference.helpMode === option ? "bg-violet-600 text-white" : "text-slate-600 hover:text-violet-700"}`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
