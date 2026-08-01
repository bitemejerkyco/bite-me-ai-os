import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redactFeedbackDescription } from "@/features/help/feedback";
import { getViewerContext } from "@/lib/auth/server";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";

export async function POST(request: Request) {
  const referenceId = crypto.randomUUID();
  try {
    const body = (await request.json()) as {
      category?: string;
      route?: string;
      browserVersion?: string;
      appVersion?: string;
      description?: string;
      screenshotUrl?: string;
    };
    const viewer = await getViewerContext();
    if (!viewer.userId) {
      return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
    }
    const workspace = await requireWorkspaceContext();
    const admin = createAdminClient();
    const { data, error } = await admin.from("help_feedback_submissions").insert({
      workspace_id: workspace.workspaceId,
      user_id: viewer.userId,
      category: String(body.category || "GENERAL_FEEDBACK").slice(0, 120),
      route: String(body.route || "/"),
      browser_version: String(body.browserVersion || "unknown").slice(0, 500),
      app_version: String(body.appVersion || "unknown").slice(0, 100),
      description: redactFeedbackDescription(String(body.description || "")),
      screenshot_url: body.screenshotUrl ? String(body.screenshotUrl).slice(0, 1000) : null,
    } as never).select("id").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, feedbackId: String((data as { id?: string } | null)?.id || referenceId) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error), referenceId }, { status: 400 });
  }
}
