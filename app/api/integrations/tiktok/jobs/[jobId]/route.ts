import { NextResponse } from "next/server";
import { resolveTikTokActor, safeTikTokError } from "@/app/api/integrations/tiktok/_lib";
import { TikTokPublishJobService } from "@/features/integrations/tiktok/publish-jobs";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const actor = await resolveTikTokActor();
    const { jobId: rawJobId } = await context.params;
    const jobId = String(rawJobId || "").trim();
    if (!jobId) {
      throw new Error("TIKTOK_JOB_INVALID:Choose a valid TikTok job.");
    }
    const job = await new TikTokPublishJobService().refreshTikTokPublishStatus(
      actor,
      jobId,
    );
    return NextResponse.json(
      { ok: true, data: job },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return safeTikTokError(error);
  }
}