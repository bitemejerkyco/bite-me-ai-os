import { NextRequest, NextResponse } from "next/server";
import { loadTikTokConfig } from "@/features/integrations/tiktok/config";
import { redactTikTokSecrets } from "@/features/integrations/tiktok/token-crypto";

const EVENT_TYPES = new Set([
  "post.publish.complete",
  "post.publish.failed",
  "post.publish.inbox_delivered",
]);

export async function POST(request: NextRequest) {
  try {
    const config = loadTikTokConfig();
    if (!config.webhooksEnabled) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "TIKTOK_WEBHOOKS_DISABLED:TikTok webhook ingestion is disabled until verified delivery and signature rules are configured.",
        },
        { status: 503 },
      );
    }

    const payload = (await request.json()) as Record<string, unknown>;
    const eventType = String(payload.event_type || payload.event || "").trim();
    const publishId = String(payload.publish_id || payload.publishId || "").trim();

    if (!EVENT_TYPES.has(eventType) || !publishId) {
      throw new Error("TIKTOK_WEBHOOK_INVALID:Malformed webhook payload.");
    }

    return NextResponse.json({ ok: true, data: { eventType, publishId } });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: redactTikTokSecrets(
          error instanceof Error ? error.message : String(error),
        ),
      },
      { status: 400 },
    );
  }
}
