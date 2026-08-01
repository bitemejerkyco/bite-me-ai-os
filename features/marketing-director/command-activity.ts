import type { MarketingDirectorStructuredPlan } from "@/features/marketing-director/conversational-plan";

export type CommandActivityStatus =
  | "request"
  | "plan_generated"
  | "approval_requested"
  | "approved"
  | "rejected"
  | "viewed"
  | "draft_created"
  | "generated"
  | "regenerated"
  | "edited"
  | "scheduled"
  | "published"
  | "dismissed"
  | "deferred"
  | "completed"
  | "failed";

export type CommandActivityEvent = {
  id: string;
  status: CommandActivityStatus;
  timestamp: string;
  userId: string | null;
  planId: string;
  request: string;
  details: string;
};

export type CommandRecord = {
  id: string;
  workspace_id: string;
  actor_user_id: string | null;
  prompt: string;
  status: string;
  proposal: unknown;
  metadata: unknown;
  created_at: string | null;
  updated_at: string | null;
};

function asArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object") as Record<string, unknown>[];
}

function toObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

export function appendCommandActivity(
  metadata: unknown,
  event: Omit<CommandActivityEvent, "id">,
): Record<string, unknown> {
  const object = toObject(metadata);
  const activity = asArray(object.activity).map((item) => ({ ...item }));
  const id = `${event.planId}_${event.status}_${event.timestamp}`;

  activity.push({
    id,
    status: event.status,
    timestamp: event.timestamp,
    userId: event.userId,
    planId: event.planId,
    request: event.request,
    details: event.details,
  });

  return {
    ...object,
    activity,
  };
}

export function planFromProposal(value: unknown): MarketingDirectorStructuredPlan | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.planId !== "string") return null;
  if (!Array.isArray(candidate.recommendedActions)) return null;
  return candidate as unknown as MarketingDirectorStructuredPlan;
}

export function getCommandActivityEvents(record: CommandRecord): CommandActivityEvent[] {
  const metadata = toObject(record.metadata);
  const activity = asArray(metadata.activity);

  const plan = planFromProposal(record.proposal);
  const fallbackPlanId = plan?.planId || `command_${record.id}`;

  const mapped = activity.map((item, index) => ({
    id: String(item.id || `${record.id}_activity_${index}`),
    status: String(item.status || "request") as CommandActivityStatus,
    timestamp: String(item.timestamp || record.created_at || new Date().toISOString()),
    userId: item.userId ? String(item.userId) : record.actor_user_id,
    planId: String(item.planId || fallbackPlanId),
    request: String(item.request || record.prompt || ""),
    details: String(item.details || ""),
  }));

  if (mapped.length > 0) {
    return mapped.sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
  }

  return [
    {
      id: `${record.id}_request`,
      status: "request",
      timestamp: String(record.created_at || new Date().toISOString()),
      userId: record.actor_user_id,
      planId: fallbackPlanId,
      request: record.prompt,
      details: "Request recorded.",
    },
  ];
}

export function activityMatchesFilter(status: CommandActivityStatus, filter: string): boolean {
  const normalized = (filter || "all").toLowerCase();
  if (normalized === "all") return true;
  if (normalized === "plans") return status === "request" || status === "plan_generated";
  if (normalized === "approvals") return status === "approval_requested" || status === "approved" || status === "rejected";
  if (normalized === "completed") {
    return ["completed", "draft_created", "generated", "regenerated", "edited", "scheduled", "published"].includes(status);
  }
  if (normalized === "failed") return status === "failed";
  return true;
}
