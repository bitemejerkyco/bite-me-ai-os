import type { PublishingQueueSummary, WorkflowSummary, ApprovalSummary } from "@/features/marketing-director/execution-engine";

export type DepartmentStatus = {
  key: "content" | "social" | "analytics" | "operations";
  label: string;
  status: "healthy" | "warning" | "critical";
  summary: string;
};

function statusFromPressure(value: number): "healthy" | "warning" | "critical" {
  if (value >= 7) return "critical";
  if (value >= 3) return "warning";
  return "healthy";
}

export function buildDepartmentStatus(input: {
  workflowSummary: WorkflowSummary;
  publishingQueue: PublishingQueueSummary;
  approvalSummary: ApprovalSummary;
}): DepartmentStatus[] {
  const contentPressure = input.approvalSummary.pending + input.workflowSummary.awaitingApproval;
  const socialPressure = input.publishingQueue.retry + input.publishingQueue.failed;
  const analyticsPressure = input.workflowSummary.inProgress + input.workflowSummary.blocked;
  const operationsPressure = input.workflowSummary.failed + input.workflowSummary.cancelled;

  return [
    {
      key: "content",
      label: "AI Content Director",
      status: statusFromPressure(contentPressure),
      summary: `${contentPressure} approval-gated items currently impact content throughput.`,
    },
    {
      key: "social",
      label: "AI Social Director",
      status: statusFromPressure(socialPressure),
      summary: `${socialPressure} queue retries/failures detected in publishing operations.`,
    },
    {
      key: "analytics",
      label: "AI Analytics Director",
      status: statusFromPressure(analyticsPressure),
      summary: `${analyticsPressure} workflows are active or blocked in collection and learning stages.`,
    },
    {
      key: "operations",
      label: "AI Operations Director",
      status: statusFromPressure(operationsPressure),
      summary: `${operationsPressure} workflows are failed or cancelled and require intervention.`,
    },
  ];
}
