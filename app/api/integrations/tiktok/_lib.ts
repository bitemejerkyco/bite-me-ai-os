import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { redactTikTokSecrets } from "@/features/integrations/tiktok/token-crypto";

export type TikTokActorContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  workspaceId: string;
};

export async function resolveTikTokActor(): Promise<TikTokActorContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("AUTH_REQUIRED:Sign in to connect TikTok.");
  }
  const { data: primaryWorkspaceId, error: primaryWorkspaceError } = await supabase.rpc("my_primary_workspace_id");
  if (primaryWorkspaceError) {
    throw new Error(`WORKSPACE_FAILED:${primaryWorkspaceError.message}`);
  }

  let workspaceId = String(primaryWorkspaceId || "").trim();
  if (!workspaceId) {
    const { data: membership, error: membershipError } = await supabase
      .from("workspace_memberships")
      .select("workspace_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (membershipError) {
      throw new Error(`WORKSPACE_FAILED:${membershipError.message}`);
    }
    workspaceId = String((membership as { workspace_id?: string } | null)?.workspace_id || "").trim();
  }

  if (!workspaceId) {
    throw new Error("WORKSPACE_REQUIRED:Complete Business Setup first.");
  }

  return {
    supabase,
    userId: user.id,
    workspaceId,
  };
}

export function safeTikTokError(error: unknown, status = 400): NextResponse {
  const message = redactTikTokSecrets(
    error instanceof Error ? error.message : String(error),
  );
  return NextResponse.json({ ok: false, error: message }, { status });
}
