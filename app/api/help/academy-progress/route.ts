import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getViewerContext } from "@/lib/auth/server";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      lessonId?: string;
      status?: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
      completionPercentage?: number;
      lastStepIndex?: number;
    };
    const viewer = await getViewerContext();
    if (!viewer.userId) {
      return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
    }
    const workspace = await requireWorkspaceContext();
    const lessonId = String(body.lessonId || "").trim();
    if (!lessonId) {
      return NextResponse.json({ ok: false, error: "lessonId is required." }, { status: 400 });
    }
    const admin = createAdminClient();
    const { error } = await admin.from("academy_lesson_progress").upsert({
      workspace_id: workspace.workspaceId,
      user_id: viewer.userId,
      lesson_id: lessonId,
      status: body.status || "IN_PROGRESS",
      completion_percentage: Math.max(0, Math.min(100, Number(body.completionPercentage || 0))),
      last_step_index: Math.max(0, Number(body.lastStepIndex || 0)),
      completed_at: body.status === "COMPLETED" ? new Date().toISOString() : undefined,
    } as never, { onConflict: "workspace_id,user_id,lesson_id" });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
