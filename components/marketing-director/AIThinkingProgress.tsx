"use client";

import { useEffect, useMemo, useState } from "react";

type AIThinkingProgressProps = {
  active: boolean;
  title?: string;
  steps?: string[];
};

const DEFAULT_STEPS = [
  "Analyzing your business...",
  "Checking connected channels...",
  "Reviewing campaign history...",
  "Building strategy...",
  "Generating content...",
  "Preparing recommendations...",
];

export default function AIThinkingProgress({
  active,
  title = "AI is working",
  steps = DEFAULT_STEPS,
}: AIThinkingProgressProps) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!active) return;

    const timer = window.setInterval(() => {
      setStepIndex((current) => (current + 1) % steps.length);
    }, 900);

    return () => window.clearInterval(timer);
  }, [active, steps.length]);

  const displayStepIndex = active ? stepIndex : 0;

  const progressPercent = useMemo(() => {
    if (!active) return 0;
    return Math.round(((displayStepIndex + 1) / steps.length) * 100);
  }, [active, displayStepIndex, steps.length]);

  if (!active) return null;

  return (
    <section className="pm-glass-premium rounded-2xl border border-violet-200/60 bg-violet-50/70 p-4" aria-live="polite" aria-busy="true">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">{title}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{steps[displayStepIndex]}</p>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-violet-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 transition-[width] duration-200"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-600">
        {steps.map((step, index) => (
            <p key={step} className={index === displayStepIndex ? "font-semibold text-violet-700" : "opacity-75"}>
            {step.replace("...", "")}
          </p>
        ))}
      </div>
    </section>
  );
}
