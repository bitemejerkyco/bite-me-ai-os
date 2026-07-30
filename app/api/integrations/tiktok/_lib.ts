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
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (workspaceError) throw new Error(`WORKSPACE_FAILED:${workspaceError.message}`);
  if (!workspace?.id) {
    throw new Error("WORKSPACE_REQUIRED:Complete Business Setup first.");
  }
  return {
    supabase,
    userId: user.id,
    workspaceId: String(workspace.id),
  };
}

export function safeTikTokError(error: unknown, status = 400): NextResponse {
  const message = redactTikTokSecrets(
    error instanceof Error ? error.message : String(error),
  );
  return NextResponse.json({ ok: false, error: message }, { status });
}
