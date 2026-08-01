import type { AutonomousRecommendation } from "@/features/marketing-director/autonomous-intelligence";

const priorityClasses: Record<AutonomousRecommendation["roiPriority"], string> = {
  critical: "border-rose-200 bg-rose-50 text-rose-700",
  high: "border-amber-200 bg-amber-50 text-amber-700",
  medium: "border-violet-200 bg-violet-50 text-violet-700",
  low: "border-slate-200 bg-slate-100 text-slate-700",
};

export default function AutonomousRecommendationCard({
  recommendation,
}: {
  recommendation: AutonomousRecommendation;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-900">{recommendation.title}</p>
        <span aria-label={`Priority ${recommendation.roiPriority}`} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${priorityClasses[recommendation.roiPriority]}`}>
          {recommendation.roiPriority}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-700">{recommendation.why}</p>
      <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
        <p><span className="font-semibold text-slate-700">Why this matters:</span> {recommendation.businessImpact}</p>
        <p><span className="font-semibold text-slate-700">What this unlocks:</span> {recommendation.expectedOutcome}</p>
        <p><span className="font-semibold text-slate-700">Estimated effort:</span> {recommendation.estimatedEffort}</p>
        <p><span className="font-semibold text-slate-700">Required approval:</span> {recommendation.approvalStatus.replaceAll("_", " ")}</p>
        <p><span className="font-semibold text-slate-700">Recommended next step:</span> {recommendation.nextWorkflow}</p>
        <p><span className="font-semibold text-slate-700">Deterministic confidence:</span> {Math.round(recommendation.confidence * 100)}%</p>
      </div>
      {recommendation.crossChannelPlan.length > 0 ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Cross-channel plan</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-700">
            {recommendation.crossChannelPlan.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
