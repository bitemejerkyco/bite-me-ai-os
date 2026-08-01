import { describe, expect, it } from "vitest";
import {
  buildDefaultExecutionWorkflow,
  retryFailedStep,
  summarizeWorkflowProgress,
  transitionWorkflowStep,
} from "@/features/marketing-director/workflow-engine";

describe("workflow-engine", () => {
  it("enforces dependency order and allows progression", () => {
    const workflow = buildDefaultExecutionWorkflow({
      id: "wf-1",
      workspaceId: "ws-1",
      workflowType: "content_execution",
    });

    const blocked = transitionWorkflowStep(workflow, "review", "IN_PROGRESS");
    expect(blocked.ok).toBe(false);

    const step1Start = transitionWorkflowStep(workflow, "generate_content", "IN_PROGRESS");
    expect(step1Start.ok).toBe(true);
    if (!step1Start.ok) return;

    const step1 = transitionWorkflowStep(step1Start.workflow, "generate_content", "COMPLETED", { allowDependencyBypass: true });
    expect(step1.ok).toBe(true);

    if (!step1.ok) return;
    const step2 = transitionWorkflowStep(step1.workflow, "review", "IN_PROGRESS");
    expect(step2.ok).toBe(true);
  });

  it("tracks retries for failed steps", () => {
    const workflow = buildDefaultExecutionWorkflow({
      id: "wf-2",
      workspaceId: "ws-1",
      workflowType: "campaign",
    });

    const startStep = transitionWorkflowStep(workflow, "generate_content", "IN_PROGRESS");
    expect(startStep.ok).toBe(true);
    if (!startStep.ok) return;

    const failStep = transitionWorkflowStep(startStep.workflow, "generate_content", "FAILED", { allowDependencyBypass: true });
    expect(failStep.ok).toBe(true);
    if (!failStep.ok) return;

    const retried = retryFailedStep(failStep.workflow, "generate_content");
    expect(retried.ok).toBe(true);
  });

  it("summarizes workflow progress", () => {
    const workflow = buildDefaultExecutionWorkflow({
      id: "wf-3",
      workspaceId: "ws-1",
      workflowType: "learning_cycle",
    });

    const summary = summarizeWorkflowProgress(workflow);
    expect(summary.totalSteps).toBe(7);
    expect(summary.completedSteps).toBe(0);
    expect(summary.percent).toBe(0);
  });
});
