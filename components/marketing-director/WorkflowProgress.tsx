type WorkflowStageView = {
  id: string;
  label: string;
  state: "complete" | "current" | "upcoming" | "blocked" | "failed";
};

const STATE_LABELS: Record<WorkflowStageView["state"], string> = {
  complete: "Complete",
  current: "Current",
  upcoming: "Upcoming",
  blocked: "Blocked",
  failed: "Failed",
};

const STATE_STYLES: Record<WorkflowStageView["state"], string> = {
  complete: "border-emerald-200 bg-emerald-50 text-emerald-800",
  current: "border-violet-200 bg-violet-50 text-violet-800",
  upcoming: "border-slate-200 bg-slate-50 text-slate-700",
  blocked: "border-amber-200 bg-amber-50 text-amber-800",
  failed: "border-rose-200 bg-rose-50 text-rose-800",
};

const STATE_MARKERS: Record<WorkflowStageView["state"], string> = {
  complete: "✓",
  current: "•",
  upcoming: "○",
  blocked: "!",
  failed: "×",
};

export default function WorkflowProgress({
  title,
  stages,
}: {
  title?: string;
  stages: WorkflowStageView[];
}) {
  if (stages.length === 0) return null;

  return (
    <section aria-label={title || "Workflow progress"} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">{title || "Workflow progress"}</p>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {stages.map((stage) => (
          <li
            key={stage.id}
            className={`rounded-xl border px-3 py-2 text-sm ${STATE_STYLES[stage.state]}`}
            aria-label={`${stage.label}: ${STATE_LABELS[stage.state]}`}
          >
            <span className="font-semibold">{STATE_MARKERS[stage.state]} {stage.label}</span>
            <span className="ml-2 text-xs uppercase tracking-[0.12em]">{STATE_LABELS[stage.state]}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
