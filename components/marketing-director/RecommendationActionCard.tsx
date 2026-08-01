import type { MarketingDirectorStructuredPlan } from "@/features/marketing-director/conversational-plan";
import {
  buildPriorityBadge,
  type RecommendationActionModel,
  type RecommendationRuntimeState,
} from "@/features/marketing-director/recommendation-workflows";

type RecommendationActionCardProps = {
  action: MarketingDirectorStructuredPlan["recommendedActions"][number];
  runtime: RecommendationRuntimeState;
  pendingGenerate: boolean;
  pendingAction: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDismiss: () => void;
  onDefer: () => void;
  onPublishNow: () => void;
  onOpenActionHref: (actionItem: RecommendationActionModel) => void;
  generatedDraft?: {
    draftId: string;
    title: string;
    approvalStatus: string;
  };
};

function stageClass(state: RecommendationRuntimeState["progress"][number]["state"]): string {
  if (state === "complete") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (state === "current") return "border-violet-200 bg-violet-50 text-violet-700";
  if (state === "failed") return "border-rose-200 bg-rose-50 text-rose-700";
  if (state === "blocked") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function isDirectButton(kind: RecommendationActionModel["kind"]): boolean {
  return ["APPROVE_DRAFT", "REJECT_DRAFT", "DISMISS", "DEFER", "PUBLISH_NOW"].includes(kind);
}

export default function RecommendationActionCard(props: RecommendationActionCardProps) {
  const priorityBadge = buildPriorityBadge(props.action.priority);

  return (
    <li className="rounded-xl border border-slate-200 bg-white/85 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-slate-900">
          {props.action.title}{" "}
          <span className="text-xs font-medium text-slate-500">({props.action.priority})</span>
        </p>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
          {priorityBadge.icon} {priorityBadge.label}
        </span>
      </div>

      <p className="mt-1 text-slate-700">{props.action.description}</p>
      <p className="mt-1 text-xs text-slate-500">Reason: {props.action.supportingData}</p>
      <p className="mt-1 text-xs text-slate-500">Target: {props.action.target}</p>

      {props.generatedDraft ? (
        <p className="mt-1 text-xs text-emerald-700">
          Draft: {props.generatedDraft.title} ({props.generatedDraft.approvalStatus})
        </p>
      ) : null}

      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Workflow</p>
        <p className="mt-1 text-xs text-slate-700">Current status: {props.runtime.workflowStatus.replaceAll("_", " ")}</p>
        {props.runtime.progress.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {props.runtime.progress.map((stage) => (
              <span
                key={stage.id}
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${stageClass(stage.state)}`}
              >
                {stage.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <details className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
        <summary className="cursor-pointer text-xs font-semibold text-slate-700">Why am I seeing this?</summary>
        <div className="mt-2 space-y-1 text-xs text-slate-600">
          <p>Type: {props.runtime.recommendationType.replaceAll("_", " ")}</p>
          {props.runtime.evidence.reason ? <p>Reason: {props.runtime.evidence.reason}</p> : null}
          {props.runtime.evidence.supportingMetric ? <p>Metric: {props.runtime.evidence.supportingMetric}</p> : null}
          {props.runtime.evidence.missingDependency ? <p>Dependency: {props.runtime.evidence.missingDependency}</p> : null}
        </div>
      </details>

      {props.runtime.impact ? (
        <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700">
          <p className="font-semibold text-slate-800">Estimated impact</p>
          {typeof props.runtime.impact.blockedItems === "number" ? <p>Blocked items: {props.runtime.impact.blockedItems}</p> : null}
          {typeof props.runtime.impact.itemsReady === "number" ? <p>Ready items: {props.runtime.impact.itemsReady}</p> : null}
          {typeof props.runtime.impact.confidence === "number" ? <p>Confidence: {props.runtime.impact.confidence}%</p> : null}
          {props.runtime.impact.timeSensitivity ? <p>Time sensitivity: {props.runtime.impact.timeSensitivity}</p> : null}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={props.pendingGenerate}
          onClick={props.onGenerate}
          className="rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {props.pendingGenerate ? "Generating..." : "Generate Content"}
        </button>
        <button
          type="button"
          disabled={props.pendingGenerate}
          onClick={props.onRegenerate}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Regenerate
        </button>

        {props.runtime.actions.map((actionItem) => {
          const disabled = Boolean(actionItem.disabled) || props.pendingAction;

          if (actionItem.kind === "APPROVE_DRAFT") {
            return (
              <button
                key={actionItem.id}
                type="button"
                disabled={disabled}
                onClick={props.onApprove}
                className="rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                title={actionItem.disabledReason || "Approve this recommendation."}
              >
                {actionItem.label}
              </button>
            );
          }

          if (actionItem.kind === "REJECT_DRAFT") {
            return (
              <button
                key={actionItem.id}
                type="button"
                disabled={disabled}
                onClick={props.onReject}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                title={actionItem.disabledReason || "Reject this recommendation."}
              >
                {actionItem.label}
              </button>
            );
          }

          if (actionItem.kind === "DISMISS") {
            return (
              <button
                key={actionItem.id}
                type="button"
                disabled={disabled}
                onClick={props.onDismiss}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                title={actionItem.disabledReason || "Dismiss this recommendation."}
              >
                {actionItem.label}
              </button>
            );
          }

          if (actionItem.kind === "DEFER") {
            return (
              <button
                key={actionItem.id}
                type="button"
                disabled={disabled}
                onClick={props.onDefer}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                title={actionItem.disabledReason || "Defer this recommendation."}
              >
                {actionItem.label}
              </button>
            );
          }

          if (actionItem.kind === "PUBLISH_NOW") {
            return (
              <button
                key={actionItem.id}
                type="button"
                disabled={disabled}
                onClick={props.onPublishNow}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
                title={actionItem.disabledReason || "Publish now."}
              >
                {actionItem.label}
              </button>
            );
          }

          if (isDirectButton(actionItem.kind)) {
            return null;
          }

          return (
            <button
              key={actionItem.id}
              type="button"
              disabled={disabled}
              onClick={() => props.onOpenActionHref(actionItem)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
              title={actionItem.disabledReason || undefined}
            >
              {actionItem.label}
            </button>
          );
        })}
      </div>
    </li>
  );
}
