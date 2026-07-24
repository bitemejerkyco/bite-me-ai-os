import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { AmazonAdsIntegrationActor } from "@/features/marketing/providers/amazon-ads/live/types";
import { redactSecrets } from "@/features/marketing/providers/amazon-ads/live/token-crypto";

const DEFAULT_WORKSPACE_ID = "workspace-sandbox-01";
const DEFAULT_USER_ID = "user-demo";
const SAFE_ID = /^[A-Za-z0-9_-]{1,100}$/;

export function resolveActor(request: NextRequest): AmazonAdsIntegrationActor {
  const { searchParams } = new URL(request.url);
  const workspaceId = (searchParams.get("workspaceId") || DEFAULT_WORKSPACE_ID).trim();
  const userId = (searchParams.get("userId") || DEFAULT_USER_ID).trim();
  if (!SAFE_ID.test(workspaceId) || !SAFE_ID.test(userId)) {
    throw new Error("ACTOR_INVALID:workspaceId and userId must be safe identifiers.");
  }
  return { workspaceId, userId };
}

export function safeErrorResponse(error: unknown, status = 400): NextResponse {
  const message = error instanceof Error ? error.message : String(error);
  return NextResponse.json(
    {
      ok: false,
      error: redactSecrets(message),
    },
    { status },
  );
}
