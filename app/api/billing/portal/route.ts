import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { createStripePortalSession } from "@/features/billing/stripe";

export async function POST(request: NextRequest) {
  try {
    const context = await requireWorkspaceContext();
    const origin = new URL(request.url).origin;
    const portal = await createStripePortalSession({
      workspaceId: context.workspaceId,
      email: context.email || `${context.workspaceId}@postmotive.local`,
      workspaceName: context.workspaceName,
      returnUrl: `${origin}/settings/billing`,
    });

    return NextResponse.json({ ok: true, data: portal });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
