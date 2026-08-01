import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadMarketingDirectorDashboard } from "@/features/marketing-director/dashboard";
import { isBriefRefreshThrottled } from "@/features/marketing-director/brief-refresh";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";

const MIN_REFRESH_INTERVAL_MS = 45 * 1000;

type BriefRequestBody = {
  refresh?: unknown;
};

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  if (message.startsWith("AUTH_REQUIRED:")) return "Sign in required.";
  if (message.startsWith("WORKSPACE_REQUIRED:")) return "Complete Business Setup first.";
  if (message.startsWith("BRIEF_REFRESH_THROTTLED:")) return "Brief was just refreshed. Please wait before refreshing again.";
  return "Unable to load executive brief right now.";
}

async function assertNotThrottled(workspaceId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("marketing_director_briefs")
    .select("updated_at")
    .eq("workspace_id", workspaceId)
    .eq("brief_date", new Date().toISOString().slice(0, 10))
    .maybeSingle();

  if (error) {
    throw new Error(`BRIEF_THROTTLE_LOOKUP_FAILED:${error.message}`);
  }

  const latestBrief = (data as { updated_at?: string | null } | null) || null;

  if (isBriefRefreshThrottled({
    lastUpdatedAt: latestBrief?.updated_at ? String(latestBrief.updated_at) : null,
    minIntervalMs: MIN_REFRESH_INTERVAL_MS,
  })) {
    throw new Error("BRIEF_REFRESH_THROTTLED:Too many refresh requests.");
  }
}

export async function GET() {
  try {
    const context = await requireWorkspaceContext();
    const dashboard = await loadMarketingDirectorDashboard({
      workspaceId: context.workspaceId,
      firstName: context.firstName,
      workspaceName: context.workspaceName,
      refreshBrief: false,
    });
    return NextResponse.json({ ok: true, brief: dashboard.brief }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: safeError(error) }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireWorkspaceContext();
    const body = (await request.json().catch(() => null)) as BriefRequestBody | null;
    const refreshRequested = body?.refresh === true || String(body?.refresh || "").toLowerCase() === "true";

    if (refreshRequested) {
      await assertNotThrottled(context.workspaceId);
    }

    const dashboard = await loadMarketingDirectorDashboard({
      workspaceId: context.workspaceId,
      firstName: context.firstName,
      workspaceName: context.workspaceName,
      refreshBrief: refreshRequested,
    });

    return NextResponse.json({ ok: true, brief: dashboard.brief }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    const throttled = message.startsWith("BRIEF_REFRESH_THROTTLED:");
    return NextResponse.json(
      { ok: false, error: safeError(error) },
      { status: throttled ? 429 : 400 },
    );
  }
}
