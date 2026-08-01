import type { MarketingDirectorStructuredPlan } from "@/features/marketing-director/conversational-plan";
import WorkflowProgress from "@/components/marketing-director/WorkflowProgress";
import { buildCustomerRecommendationCard } from "@/features/marketing-director/customer-recommendations";
import {
  buildPriorityBadge,
  type RecommendationActionModel,
  type RecommendationRuntimeState,
} from "@/features/marketing-director/recommendation-workflows";

type RecommendationActionCardProps = {
  action: MarketingDirectorStructuredPlan["recommendedActions"][number];
  runtime: RecommendationRuntimeState;
  canViewTechnicalDetails: boolean;
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

function isDirectButton(kind: RecommendationActionModel["kind"]): boolean {
  return ["APPROVE_DRAFT", "REJECT_DRAFT", "DISMISS", "DEFER", "PUBLISH_NOW"].includes(kind);
}

export default function RecommendationActionCard(props: RecommendationActionCardProps) {
  const priorityBadge = buildPriorityBadge(props.action.priority);
  const card = buildCustomerRecommendationCard({
    action: props.action,
    runtime: props.runtime,
    canViewTechnicalDetails: props.canViewTechnicalDetails,
    generatedDraftTitle: props.generatedDraft?.title,
  });
  const visibleSecondaryActions = card.secondaryActions.slice(0, 4);
  const overflowSecondaryActions = card.secondaryActions.slice(4);

  return (
    <li className="rounded-xl border border-slate-200 bg-white/85 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-slate-900">{card.title}</p>
        <span aria-label={`Priority ${priorityBadge.label}`} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-700">
          {priorityBadge.icon} {priorityBadge.label}
        </span>
      </div>

      <p className="mt-2 text-sm text-slate-700">{card.summary}</p>
      {card.whyItMatters ? <p className="mt-2 text-sm text-slate-600"><span className="font-semibold text-slate-800">Why this matters:</span> {card.whyItMatters}</p> : null}
      {card.currentState ? <p className="mt-2 text-sm text-slate-600"><span className="font-semibold text-slate-800">Current state:</span> {card.currentState}</p> : null}
      {card.requiredApproval ? <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{card.requiredApproval}</p> : null}
      {card.blocker ? <p className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"><span className="font-semibold">Blocker:</span> {card.blocker}</p> : null}

      {props.generatedDraft ? (
        <p className="mt-2 text-xs text-emerald-700">
          Draft: {props.generatedDraft.title} ({props.generatedDraft.approvalStatus})
        </p>
      ) : null}

      <div className="mt-3">
        <WorkflowProgress title="Workflow" stages={card.workflow || []} />
      </div>

      {card.impact && card.impact.length > 0 ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-800">Impact</p>
          <ul className="mt-2 space-y-1">
            {card.impact.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <details className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
        <summary className="cursor-pointer text-xs font-semibold text-slate-700">Why am I seeing this?</summary>
        <div className="mt-2 space-y-1 text-xs text-slate-600">
          {card.evidence?.map((item) => (
            <p key={`${item.label}:${item.value}`}><span className="font-semibold text-slate-700">{item.label}:</span> {item.value}</p>
          ))}
          {card.recommendedNextStep ? <p><span className="font-semibold text-slate-700">Recommended fix:</span> {card.recommendedNextStep}</p> : null}
        </div>
      </details>

      {card.technicalDetails && card.technicalDetails.length > 0 ? (
        <details className="mt-2 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700">
          <summary className="cursor-pointer font-semibold text-slate-700">Technical details</summary>
          <div className="mt-2 space-y-1">
            {card.technicalDetails.map((item) => (
              <p key={`${item.label}:${item.value}`}><span className="font-semibold text-slate-800">{item.label}:</span> {item.value}</p>
            ))}
          </div>
        </details>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {card.primaryAction ? (
          <button
            type="button"
            disabled={Boolean(card.primaryAction.disabled) || props.pendingAction}
            onClick={() => {
              const actionItem = props.runtime.actions.find((item) => item.id === card.primaryAction?.id);
              if (!actionItem) return;
              if (actionItem.kind === "GENERATE_CONTENT") return void props.onGenerate();
              if (actionItem.kind === "APPROVE_DRAFT") return void props.onApprove();
              if (actionItem.kind === "REJECT_DRAFT") return void props.onReject();
              if (actionItem.kind === "PUBLISH_NOW") return void props.onPublishNow();
              if (actionItem.kind === "DISMISS") return void props.onDismiss();
              if (actionItem.kind === "DEFER") return void props.onDefer();
              return void props.onOpenActionHref(actionItem);
            }}
            className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            title={card.primaryAction.disabledReason || undefined}
          >
            {card.primaryAction.kind === "GENERATE_CONTENT" && props.pendingGenerate ? "Generating..." : card.primaryAction.label}
          </button>
        ) : null}

        {visibleSecondaryActions.map((actionItem) => {
          const runtimeAction = props.runtime.actions.find((item) => item.id === actionItem.id);
          if (!runtimeAction || actionItem.id === card.primaryAction?.id) return null;

          if (runtimeAction.kind === "REGENERATE_CONTENT") {
            return (
              <button
                key={runtimeAction.id}
                type="button"
                disabled={props.pendingGenerate}
                onClick={props.onRegenerate}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Regenerate
              </button>
            );
          }

          if (runtimeAction.kind === "DISMISS") {
            return <button key={runtimeAction.id} type="button" disabled={props.pendingAction} onClick={props.onDismiss} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60">{actionItem.label}</button>;
          }
          if (runtimeAction.kind === "DEFER") {
            return <button key={runtimeAction.id} type="button" disabled={props.pendingAction} onClick={props.onDefer} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60">{actionItem.label}</button>;
          }
          if (runtimeAction.kind === "APPROVE_DRAFT") {
            return <button key={runtimeAction.id} type="button" disabled={props.pendingAction || runtimeAction.disabled} onClick={props.onApprove} className="rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60" title={runtimeAction.disabledReason || undefined}>{actionItem.label}</button>;
          }
          if (runtimeAction.kind === "REJECT_DRAFT") {
            return <button key={runtimeAction.id} type="button" disabled={props.pendingAction || runtimeAction.disabled} onClick={props.onReject} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60" title={runtimeAction.disabledReason || undefined}>{actionItem.label}</button>;
          }
          if (runtimeAction.kind === "PUBLISH_NOW") {
            return <button key={runtimeAction.id} type="button" disabled={props.pendingAction || runtimeAction.disabled} onClick={props.onPublishNow} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60" title={runtimeAction.disabledReason || undefined}>{actionItem.label}</button>;
          }
          if (isDirectButton(runtimeAction.kind)) return null;

          return (
            <button key={runtimeAction.id} type="button" disabled={runtimeAction.disabled || props.pendingAction} onClick={() => props.onOpenActionHref(runtimeAction)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60" title={runtimeAction.disabledReason || undefined}>
              {actionItem.label}
            </button>
          );
        })}

        {overflowSecondaryActions.length > 0 ? (
          <details className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
            <summary className="cursor-pointer font-semibold">More actions</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {overflowSecondaryActions.map((actionItem) => {
                const runtimeAction = props.runtime.actions.find((item) => item.id === actionItem.id);
                if (!runtimeAction) return null;
                return <button key={runtimeAction.id} type="button" disabled={runtimeAction.disabled || props.pendingAction} onClick={() => props.onOpenActionHref(runtimeAction)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60">{actionItem.label}</button>;
              })}
            </div>
          </details>
        ) : null}
      </div>
    </li>
  );
}
