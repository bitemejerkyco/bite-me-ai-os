"use client";

import { useEffect, useMemo, useState } from "react";
import { useHelp } from "@/components/help/HelpContext";

function rectForSelector(selector?: string) {
  if (!selector) return null;
  const target = document.querySelector(selector) as HTMLElement | null;
  if (!target) return null;
  const rect = target.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

export default function WalkthroughOverlay() {
  const { walkthrough } = useHelp();
  const [targetRect, setTargetRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  const step = useMemo(() => {
    if (!walkthrough.active) return null;
    return walkthrough.active.steps[walkthrough.stepIndex] || null;
  }, [walkthrough.active, walkthrough.stepIndex]);

  useEffect(() => {
    if (!step) return;
    const update = () => setTargetRect(rectForSelector(step.targetSelector));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [step]);

  if (!walkthrough.active || !step) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-slate-900/35" />
      {targetRect ? (
        <div
          className="absolute rounded-3xl border-2 border-violet-400 shadow-[0_0_0_9999px_rgba(15,23,42,0.28)] transition-all"
          style={{ top: targetRect.top - 8, left: targetRect.left - 8, width: targetRect.width + 16, height: targetRect.height + 16 }}
        />
      ) : null}
      <div className="pointer-events-auto absolute bottom-5 right-5 w-[min(92vw,26rem)] rounded-[2rem] border border-white/80 bg-white p-5 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">Walkthrough</p>
        <h3 className="mt-2 text-lg font-black tracking-tight text-slate-900">{step.title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-700">{step.description}</p>
        {!targetRect ? <p className="mt-2 text-xs text-amber-700">This step target is not available on the current screen, so the walkthrough is failing safely.</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => void walkthrough.back()} disabled={walkthrough.stepIndex === 0} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40">
            Back
          </button>
          <button type="button" onClick={() => void walkthrough.next()} className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500">
            {walkthrough.stepIndex >= walkthrough.active.steps.length - 1 ? "Finish" : "Next"}
          </button>
          <button type="button" onClick={() => void walkthrough.skip()} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
            Skip
          </button>
          <button type="button" onClick={() => void walkthrough.restart()} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
            Restart
          </button>
        </div>
      </div>
    </div>
  );
}
