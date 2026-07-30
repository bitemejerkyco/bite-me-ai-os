import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  attachSessionCookie,
  resolveAuthenticatedSession,
  safeErrorResponse,
} from "@/app/api/integrations/amazon-ads/_lib";
import { buildDashboardViewModel } from "@/features/marketing/providers/amazon-ads/insights/view-model";
import { AmazonAdsLiveReportService } from "@/features/marketing/providers/amazon-ads/live/report-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = resolveAuthenticatedSession(request);
    const url = new URL(request.url);
    const endDate = url.searchParams.get("endDate") || "";
    const startDate = url.searchParams.get("startDate") || "";
    const correlationId = request.headers.get("x-correlation-id") || randomUUID();
    const result = await new AmazonAdsLiveReportService().loadSearchTermPerformance({
      actor: session.actor,
      startDate,
      endDate,
      correlationId,
    });
    const response = NextResponse.json({
      ok: true,
      data: buildDashboardViewModel(result.records, result.generatedAt, "LIVE"),
      meta: { correlationId, reportId: result.reportId },
    });
    response.headers.set("cache-control", "no-store");
    attachSessionCookie(response, session);
    return response;
  } catch (error) {
    return safeErrorResponse(error, 400);
  }
}
