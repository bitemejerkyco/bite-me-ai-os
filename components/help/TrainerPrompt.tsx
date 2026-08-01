"use client";

import { useHelp } from "@/components/help/HelpContext";

export default function TrainerPrompt() {
  const { trainerPrompt, dismissTrainerPrompt, walkthrough, setAssistantOpen } = useHelp();

  if (!trainerPrompt) return null;

  return (
    <div className="fixed bottom-24 left-5 z-[75] w-[min(92vw,24rem)] rounded-[1.8rem] border border-amber-300 bg-white p-4 shadow-2xl">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">AI Trainer</p>
      <h2 className="mt-1 text-base font-black tracking-tight text-slate-900">{trainerPrompt.title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">{trainerPrompt.message}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => void walkthrough.start(trainerPrompt.suggestedWalkthroughId)} className="rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-400">
          Walk me through it
        </button>
        <button type="button" onClick={() => setAssistantOpen(true)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
          Show instructions
        </button>
        <button type="button" onClick={() => void dismissTrainerPrompt({ dontShowAgain: false })} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
          Not now
        </button>
        <button type="button" onClick={() => void dismissTrainerPrompt({ dontShowAgain: true })} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
          Don’t show again
        </button>
      </div>
    </div>
  );
}
