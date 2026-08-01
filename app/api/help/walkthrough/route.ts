import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewerContext } from "@/lib/auth/server";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: string;
      walkthroughId?: string;
      route?: string;
      version?: string;
      stepIndex?: number;
      promptKey?: string;
      dontShowAgain?: boolean;
    };
    const viewer = await getViewerContext();
    if (!viewer.userId) {
      return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
    }

    const action = String(body.action || "");
    const admin = createAdminClient();

    if (action === "dismiss_prompt") {
      const workspace = await requireWorkspaceContext();
      const { error } = await admin.from("help_trainer_prompt_dismissals").upsert({
        workspace_id: workspace.workspaceId,
        user_id: viewer.userId,
        prompt_key: String(body.promptKey || "unknown"),
        route: String(body.route || workspace.workspaceId),
        dont_show_again: Boolean(body.dontShowAgain),
      } as never, { onConflict: "workspace_id,user_id,prompt_key,route" });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    const workspace = await requireWorkspaceContext();
    const walkthroughId = String(body.walkthroughId || "").trim();
    if (!walkthroughId) {
      return NextResponse.json({ ok: false, error: "walkthroughId is required." }, { status: 400 });
    }

    const status = action === "finish"
      ? "COMPLETED"
      : action === "skip"
        ? "SKIPPED"
        : "IN_PROGRESS";

    const { error } = await admin.from("help_walkthrough_progress").upsert({
      workspace_id: workspace.workspaceId,
      user_id: viewer.userId,
      walkthrough_id: walkthroughId,
      walkthrough_version: String(body.version || "1"),
      status,
      current_step_index: Math.max(0, Number(body.stepIndex || 0)),
      last_route: String(body.route || workspace.workspaceId),
      started_at: action === "start" || action === "restart" ? new Date().toISOString() : undefined,
      completed_at: action === "finish" ? new Date().toISOString() : undefined,
      metadata: { lastAction: action },
    } as never, { onConflict: "workspace_id,user_id,walkthrough_id" });

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
