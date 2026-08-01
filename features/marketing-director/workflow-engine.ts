export const WORKFLOW_STATES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "BLOCKED",
  "AWAITING_APPROVAL",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHING",
  "PUBLISHED",
  "COLLECTING_RESULTS",
  "LEARNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export type WorkflowState = (typeof WORKFLOW_STATES)[number];

export type WorkflowStep = {
  id: string;
  key: string;
  title: string;
  state: WorkflowState;
  dependsOn: string[];
  retryCount: number;
  maxRetries: number;
  assignedAgent?: string;
  targetRecordType?: string;
  targetRecordId?: string;
  comment?: string;
};

export type WorkflowModel = {
  id: string;
  workspaceId: string;
  workflowType:
    | "campaign"
    | "content_execution"
    | "approval_batch"
    | "publishing_batch"
    | "analytics_collection"
    | "learning_cycle";
  state: WorkflowState;
  retryCount: number;
  maxRetries: number;
  blockedReason?: string;
  failureReason?: string;
  startedAt?: string;
  completedAt?: string;
  steps: WorkflowStep[];
};

export type WorkflowTransitionResult =
  | { ok: true; workflow: WorkflowModel; changedStep?: WorkflowStep }
  | { ok: false; code: "INVALID_WORKFLOW" | "WORKFLOW_BLOCKED"; message: string };

const ALLOWED_STATE_TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  NOT_STARTED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["BLOCKED", "AWAITING_APPROVAL", "SCHEDULED", "FAILED", "CANCELLED", "COMPLETED"],
  BLOCKED: ["IN_PROGRESS", "CANCELLED", "FAILED"],
  AWAITING_APPROVAL: ["APPROVED", "CANCELLED", "FAILED"],
  APPROVED: ["SCHEDULED", "PUBLISHING", "CANCELLED", "FAILED"],
  SCHEDULED: ["PUBLISHING", "CANCELLED", "FAILED"],
  PUBLISHING: ["PUBLISHED", "FAILED", "CANCELLED"],
  PUBLISHED: ["COLLECTING_RESULTS", "LEARNING", "COMPLETED"],
  COLLECTING_RESULTS: ["LEARNING", "FAILED", "COMPLETED"],
  LEARNING: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: ["IN_PROGRESS", "CANCELLED"],
  CANCELLED: [],
};

function canTransition(from: WorkflowState, to: WorkflowState): boolean {
  return ALLOWED_STATE_TRANSITIONS[from]?.includes(to) || false;
}

function resolveWorkflowStateFromSteps(steps: WorkflowStep[]): WorkflowState {
  if (steps.length === 0) return "NOT_STARTED";
  if (steps.some((step) => step.state === "FAILED")) return "FAILED";
  if (steps.every((step) => step.state === "COMPLETED")) return "COMPLETED";
  if (steps.some((step) => step.state === "BLOCKED")) return "BLOCKED";
  if (steps.some((step) => step.state === "AWAITING_APPROVAL")) return "AWAITING_APPROVAL";
  if (steps.some((step) => step.state === "PUBLISHING")) return "PUBLISHING";
  if (steps.some((step) => step.state === "SCHEDULED")) return "SCHEDULED";
  if (steps.some((step) => step.state === "PUBLISHED")) return "PUBLISHED";
  if (steps.some((step) => step.state === "COLLECTING_RESULTS")) return "COLLECTING_RESULTS";
  if (steps.some((step) => step.state === "LEARNING")) return "LEARNING";
  if (steps.some((step) => step.state === "IN_PROGRESS" || step.state === "APPROVED")) return "IN_PROGRESS";
  if (steps.some((step) => step.state === "CANCELLED")) return "CANCELLED";
  return "NOT_STARTED";
}

export function isStepReady(workflow: WorkflowModel, stepKey: string): boolean {
  const step = workflow.steps.find((item) => item.key === stepKey);
  if (!step) return false;
  if (step.dependsOn.length === 0) return true;

  return step.dependsOn.every((dependency) => {
    const dep = workflow.steps.find((item) => item.key === dependency);
    return dep?.state === "COMPLETED" || dep?.state === "APPROVED" || dep?.state === "PUBLISHED";
  });
}

export function transitionWorkflowState(
  workflow: WorkflowModel,
  nextState: WorkflowState,
  options?: { blockedReason?: string; failureReason?: string },
): WorkflowTransitionResult {
  if (!canTransition(workflow.state, nextState)) {
    return {
      ok: false,
      code: "INVALID_WORKFLOW",
      message: `Invalid transition from ${workflow.state} to ${nextState}.`,
    };
  }

  if (workflow.state === "BLOCKED" && nextState !== "IN_PROGRESS" && nextState !== "FAILED" && nextState !== "CANCELLED") {
    return {
      ok: false,
      code: "WORKFLOW_BLOCKED",
      message: "Workflow is blocked and cannot continue until dependencies are resolved.",
    };
  }

  const now = new Date().toISOString();
  const updated: WorkflowModel = {
    ...workflow,
    state: nextState,
    blockedReason: nextState === "BLOCKED" ? options?.blockedReason || workflow.blockedReason : undefined,
    failureReason: nextState === "FAILED" ? options?.failureReason || workflow.failureReason : undefined,
    startedAt: workflow.startedAt || (nextState === "IN_PROGRESS" ? now : workflow.startedAt),
    completedAt: nextState === "COMPLETED" ? now : workflow.completedAt,
  };

  return { ok: true, workflow: updated };
}

export function transitionWorkflowStep(
  workflow: WorkflowModel,
  stepKey: string,
  nextState: WorkflowState,
  options?: { comment?: string; allowDependencyBypass?: boolean },
): WorkflowTransitionResult {
  const target = workflow.steps.find((item) => item.key === stepKey);
  if (!target) {
    return { ok: false, code: "INVALID_WORKFLOW", message: `Step ${stepKey} does not exist.` };
  }

  if (!canTransition(target.state, nextState)) {
    return {
      ok: false,
      code: "INVALID_WORKFLOW",
      message: `Invalid step transition from ${target.state} to ${nextState}.`,
    };
  }

  if (!options?.allowDependencyBypass && !isStepReady(workflow, stepKey) && nextState !== "BLOCKED") {
    return {
      ok: false,
      code: "WORKFLOW_BLOCKED",
      message: `Step ${stepKey} is waiting for dependencies.`,
    };
  }

  const updatedSteps = workflow.steps.map((step) => {
    if (step.key !== stepKey) return step;
    const retryCount = nextState === "FAILED" ? step.retryCount + 1 : step.retryCount;
    return {
      ...step,
      state: nextState,
      retryCount,
      comment: options?.comment || step.comment,
    };
  });

  const nextWorkflowState = resolveWorkflowStateFromSteps(updatedSteps);
  const updatedWorkflow: WorkflowModel = {
    ...workflow,
    steps: updatedSteps,
    state: nextWorkflowState,
    retryCount: nextState === "FAILED" ? workflow.retryCount + 1 : workflow.retryCount,
    failureReason: nextState === "FAILED" ? `Step ${stepKey} failed.` : workflow.failureReason,
  };

  const changedStep = updatedSteps.find((step) => step.key === stepKey);
  return { ok: true, workflow: updatedWorkflow, changedStep };
}

export function retryFailedStep(workflow: WorkflowModel, stepKey: string): WorkflowTransitionResult {
  const step = workflow.steps.find((item) => item.key === stepKey);
  if (!step) {
    return { ok: false, code: "INVALID_WORKFLOW", message: `Step ${stepKey} does not exist.` };
  }

  if (step.state !== "FAILED") {
    return { ok: false, code: "INVALID_WORKFLOW", message: `Step ${stepKey} is not failed.` };
  }

  if (step.retryCount >= step.maxRetries) {
    return {
      ok: false,
      code: "WORKFLOW_BLOCKED",
      message: `Step ${stepKey} exceeded retry limit (${step.maxRetries}).`,
    };
  }

  return transitionWorkflowStep(workflow, stepKey, "IN_PROGRESS", {
    comment: "Retry requested.",
    allowDependencyBypass: true,
  });
}

export function summarizeWorkflowProgress(workflow: WorkflowModel): {
  completedSteps: number;
  totalSteps: number;
  percent: number;
  blockedSteps: number;
  failedSteps: number;
} {
  const total = workflow.steps.length;
  const completed = workflow.steps.filter((item) => item.state === "COMPLETED" || item.state === "PUBLISHED").length;
  const blocked = workflow.steps.filter((item) => item.state === "BLOCKED").length;
  const failed = workflow.steps.filter((item) => item.state === "FAILED").length;

  return {
    completedSteps: completed,
    totalSteps: total,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    blockedSteps: blocked,
    failedSteps: failed,
  };
}

export function buildDefaultExecutionWorkflow(input: {
  id: string;
  workspaceId: string;
  workflowType: WorkflowModel["workflowType"];
}): WorkflowModel {
  const steps: WorkflowStep[] = [
    {
      id: `${input.id}_generate`,
      key: "generate_content",
      title: "Generate Content",
      state: "NOT_STARTED",
      dependsOn: [],
      retryCount: 0,
      maxRetries: 2,
      assignedAgent: "AI Content Director",
    },
    {
      id: `${input.id}_review`,
      key: "review",
      title: "Review",
      state: "NOT_STARTED",
      dependsOn: ["generate_content"],
      retryCount: 0,
      maxRetries: 1,
      assignedAgent: "AI Marketing Director",
    },
    {
      id: `${input.id}_approve`,
      key: "approve",
      title: "Approve",
      state: "NOT_STARTED",
      dependsOn: ["review"],
      retryCount: 0,
      maxRetries: 1,
    },
    {
      id: `${input.id}_schedule`,
      key: "schedule",
      title: "Schedule",
      state: "NOT_STARTED",
      dependsOn: ["approve"],
      retryCount: 0,
      maxRetries: 2,
      assignedAgent: "AI Social Director",
    },
    {
      id: `${input.id}_publish`,
      key: "publish",
      title: "Publish",
      state: "NOT_STARTED",
      dependsOn: ["schedule"],
      retryCount: 0,
      maxRetries: 3,
      assignedAgent: "AI Social Director",
    },
    {
      id: `${input.id}_collect`,
      key: "collect_analytics",
      title: "Collect Analytics",
      state: "NOT_STARTED",
      dependsOn: ["publish"],
      retryCount: 0,
      maxRetries: 2,
      assignedAgent: "AI Analytics Director",
    },
    {
      id: `${input.id}_learn`,
      key: "learn",
      title: "Learn",
      state: "NOT_STARTED",
      dependsOn: ["collect_analytics"],
      retryCount: 0,
      maxRetries: 1,
      assignedAgent: "AI Marketing Director",
    },
  ];

  return {
    id: input.id,
    workspaceId: input.workspaceId,
    workflowType: input.workflowType,
    state: "NOT_STARTED",
    retryCount: 0,
    maxRetries: 3,
    steps,
  };
}
