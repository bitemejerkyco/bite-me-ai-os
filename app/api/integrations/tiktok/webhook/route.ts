import { NextRequest, NextResponse } from "next/server";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { loadTikTokConfig } from "@/features/integrations/tiktok/config";
import { redactTikTokSecrets } from "@/features/integrations/tiktok/token-crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { queueIntegrationJob, writeIntegrationEvent } from "@/features/integrations/core/jobs";

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

    const webhookSecret = String(process.env.TIKTOK_WEBHOOK_SECRET || "").trim();
    if (!webhookSecret) {
      throw new Error(
        "TIKTOK_WEBHOOKS_DISABLED:TIKTOK_WEBHOOK_SECRET must be configured before webhook ingestion is enabled.",
      );
    }

    const rawBody = await request.text();
    const signatureHeader =
      request.headers.get("x-tiktok-signature") ||
      request.headers.get("tiktok-signature") ||
      "";
    if (!signatureHeader) {
      throw new Error("TIKTOK_WEBHOOK_INVALID:Missing webhook signature.");
    }

    const expectedHex = createHmac("sha256", webhookSecret)
      .update(rawBody, "utf8")
      .digest("hex");
    const provided = signatureHeader.trim().replace(/^sha256=/iu, "");
    const expectedBuffer = Buffer.from(expectedHex, "hex");
    const providedBuffer = Buffer.from(provided, "hex");
    if (
      providedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      throw new Error("TIKTOK_WEBHOOK_INVALID:Webhook signature verification failed.");
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const eventType = String(payload.event_type || payload.event || "").trim();
    const publishId = String(payload.publish_id || payload.publishId || "").trim();

    if (!EVENT_TYPES.has(eventType) || !publishId) {
      throw new Error("TIKTOK_WEBHOOK_INVALID:Malformed webhook payload.");
    }

    const admin = createAdminClient();

    let workspaceId = String(payload.workspace_id || "").trim() || null;
    if (!workspaceId) {
      const publishLookup = await admin
        .from("tiktok_publish_jobs")
        .select("workspace_id")
        .eq("publish_id", publishId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      workspaceId = String((publishLookup.data as { workspace_id?: string | null } | null)?.workspace_id || "").trim() || null;
    }
    const externalEventId = String(payload.event_id || payload.id || "").trim() || null;
    const payloadHash = createHash("sha256").update(rawBody, "utf8").digest("hex");
    const dedupeKey = externalEventId || payloadHash;

    const existing = await admin
      .from("integration_webhook_events")
      .select("id,status")
      .eq("provider", "tiktok")
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();
    const existingRow = existing.data as { id?: string | null; status?: string | null } | null;

    if (existingRow?.id) {
      await writeIntegrationEvent({
        workspaceId,
        provider: "tiktok",
        operation: "webhook_receive",
        status: "duplicate",
        severity: "warning",
        message: `Duplicate TikTok webhook ignored (${eventType}).`,
        metadata: { publishId, dedupeKey },
      });
      return NextResponse.json({ ok: true, data: { duplicate: true } });
    }

    const insert = await admin
      .from("integration_webhook_events")
      .insert(
        {
          workspace_id: workspaceId,
          provider: "tiktok",
          external_event_id: externalEventId,
          webhook_signature: signatureHeader.slice(0, 64),
          payload,
          payload_hash: payloadHash,
          dedupe_key: dedupeKey,
          status: "VERIFIED",
          metadata: {
            eventType,
            publishId,
          },
        } as never,
      )
      .select("id")
      .single();
    const insertedRow = insert.data as { id?: string | null } | null;

    if (insert.error || !insertedRow?.id) {
      throw new Error(`TIKTOK_WEBHOOK_STORE_FAILED:${insert.error?.message || "Unable to store webhook event."}`);
    }

    const jobId = workspaceId
      ? await queueIntegrationJob({
          workspaceId,
          provider: "tiktok",
          type: "PROCESS_WEBHOOK",
          payload: {
            webhookEventId: String(insertedRow.id),
            publishId,
            eventType,
          },
          idempotencyKey: `tiktok-webhook-${dedupeKey}`,
          priority: 85,
          maxAttempts: 6,
          createdBy: null,
          workflowId: null,
        })
      : null;

    await writeIntegrationEvent({
      workspaceId,
      provider: "tiktok",
      operation: "webhook_receive",
      status: workspaceId ? "queued" : "accepted_without_workspace",
      severity: workspaceId ? "info" : "warning",
      message: workspaceId
        ? `TikTok webhook accepted (${eventType}).`
        : `TikTok webhook accepted (${eventType}) but could not be mapped to a workspace.`,
      jobId,
      metadata: { publishId, dedupeKey },
    });

    return NextResponse.json({ ok: true, data: { eventType, publishId, jobId } });
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
