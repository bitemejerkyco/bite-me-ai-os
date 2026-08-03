import { NextResponse } from "next/server";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { renderJobQueue } from "@/features/core/render-job-queue";

export async function POST(request: Request) {
  try {
    const context = await requireWorkspaceContext();
    const input = (await request.json().catch(() => null)) as {
      action?: unknown;
      projectId?: unknown;
      workflowKey?: unknown;
      prompt?: unknown;
      durationSeconds?: unknown;
      qualityTier?: unknown;
      provider?: unknown;
      jobId?: unknown;
      progressPercent?: unknown;
      outputUrl?: unknown;
      failureCode?: unknown;
      failureReason?: unknown;
    } | null;

    const action = String(input?.action || "create").toLowerCase();

    if (action === "create") {
      const projectId = String(input?.projectId || "").trim();
      const workflowKey = String(input?.workflowKey || "").trim();
      if (!projectId || !workflowKey) {
        throw new Error("RENDER_JOB_INVALID:projectId and workflowKey are required.");
      }
      const created = await renderJobQueue.createJob({
        workspaceId: context.workspaceId,
        projectId,
        workflowKey,
        prompt: String(input?.prompt || "").trim(),
        durationSeconds: Math.max(1, Number(input?.durationSeconds || 1)),
        qualityTier: ["ECONOMY", "BALANCED", "PREMIUM"].includes(String(input?.qualityTier || "").toUpperCase())
          ? (String(input?.qualityTier || "").toUpperCase() as "ECONOMY" | "BALANCED" | "PREMIUM")
          : "ECONOMY",
        provider: ["OPENAI", "REPLICATE", "INTERNAL"].includes(String(input?.provider || "").toUpperCase())
          ? (String(input?.provider || "").toUpperCase() as "OPENAI" | "REPLICATE" | "INTERNAL")
          : "INTERNAL",
      });
      return NextResponse.json({ ok: true, data: created });
    }

    if (action === "claim") {
      const claimed = await renderJobQueue.claimJob({
        workspaceId: context.workspaceId,
        workerId: context.userId,
      });
      return NextResponse.json({ ok: true, data: claimed });
    }

    const jobId = String(input?.jobId || "").trim();
    if (!jobId) throw new Error("RENDER_JOB_INVALID:jobId is required.");

    if (action === "progress") {
      const updated = await renderJobQueue.updateProgress({
        jobId,
        status: "in_progress",
        progressPercent: Number(input?.progressPercent || 0),
        outputUrl: String(input?.outputUrl || "") || undefined,
      });
      return NextResponse.json({ ok: true, data: updated });
    }

    if (action === "complete") {
      const completed = await renderJobQueue.completeJob({
        jobId,
        outputUrl: String(input?.outputUrl || "").trim(),
      });
      return NextResponse.json({ ok: true, data: completed });
    }

    if (action === "fail") {
      const failed = await renderJobQueue.failJob({
        jobId,
        failureCode: String(input?.failureCode || "RENDER_FAILED"),
        failureReason: String(input?.failureReason || "Render failed."),
      });
      return NextResponse.json({ ok: true, data: failed });
    }

    if (action === "retry") {
      const retried = await renderJobQueue.retryJob({
        jobId,
        reason: String(input?.failureReason || "Retry requested."),
      });
      return NextResponse.json({ ok: true, data: retried });
    }

    throw new Error("RENDER_JOB_INVALID_ACTION");
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
