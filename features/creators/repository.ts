import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { buildCreatorDemoData } from "@/features/creators/demo-data";
import { buildCreatorRecommendations } from "@/features/creators/recommendations";
import type {
  Creator,
  CreatorCampaign,
  CreatorPipelineRecord,
  CreatorRecommendation,
  CreatorRecommendationInput,
  CreatorSubmission,
  CreatorUgcAsset,
} from "@/features/creators/types";

type CreatorHubData = {
  creators: Creator[];
  campaigns: CreatorCampaign[];
  pipeline: CreatorPipelineRecord[];
  submissions: CreatorSubmission[];
  ugcAssets: CreatorUgcAsset[];
  recommendations: CreatorRecommendation[];
  activity: Array<{ id: string; summary: string; eventType: string; createdAt: string }>;
  analytics: {
    measured: {
      activeCampaigns: number;
      creatorsEngaged: number;
      contentSubmitted: number;
      contentApproved: number;
      publishedAssets: number;
      reach: number | null;
      impressions: number | null;
      engagement: number | null;
      clicks: number | null;
      conversions: number | null;
      revenue: number | null;
      campaignSpend: number | null;
      costPerEngagement: number | null;
      costPerAcquisition: number | null;
      creatorRoi: number | null;
    };
    estimated: { campaignSpend: number | null };
    isDemo: boolean;
  };
  isDemo: boolean;
};

function defaultRecommendationContext(): CreatorRecommendationInput {
  return {
    brandProfile: "Performance-first snack brand",
    industry: "Food and beverage",
    productsOrServices: ["jerky", "protein snack", "trail snack"],
    campaignGoal: "Awareness and conversion",
    targetAudience: "Active adults, gym goers, outdoors audience",
    location: "United States",
    connectedPlatforms: ["Instagram", "TikTok", "YouTube", "LinkedIn"],
  };
}

export async function loadCreatorHubData(input: {
  workspaceId: string;
  userId: string;
}): Promise<CreatorHubData> {
  const demo = buildCreatorDemoData(input.workspaceId, input.userId);

  try {
    const admin = createAdminClient();
    const [
      creatorsResult,
      campaignsResult,
      pipelineResult,
      submissionsResult,
      ugcResult,
      activityResult,
      metricsResult,
    ] = await Promise.all([
      admin.from("creators").select("*").eq("workspace_id", input.workspaceId).order("created_at", { ascending: false }).limit(250),
      admin.from("creator_campaigns").select("*").eq("workspace_id", input.workspaceId).order("created_at", { ascending: false }).limit(200),
      admin.from("creator_pipeline_records").select("*").eq("workspace_id", input.workspaceId).order("updated_at", { ascending: false }).limit(300),
      admin.from("creator_submissions").select("*").eq("workspace_id", input.workspaceId).order("created_at", { ascending: false }).limit(300),
      admin.from("creator_ugc_assets").select("*").eq("workspace_id", input.workspaceId).order("created_at", { ascending: false }).limit(300),
      admin.from("creator_activity_events").select("id,event_type,summary,created_at").eq("workspace_id", input.workspaceId).order("created_at", { ascending: false }).limit(100),
      admin.from("creator_metric_snapshots").select("*").eq("workspace_id", input.workspaceId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (creatorsResult.error || campaignsResult.error || pipelineResult.error || submissionsResult.error || ugcResult.error || activityResult.error) {
      return buildDemoBundle(input.workspaceId, input.userId);
    }

    const creators = ((creatorsResult.data as Creator[] | null) || []).map((row) => ({
      ...row,
      workspaceId: (row as unknown as { workspace_id?: string }).workspace_id || row.workspaceId,
    }));

    if (creators.length === 0) {
      return buildDemoBundle(input.workspaceId, input.userId);
    }

    const recommendations = buildCreatorRecommendations({
      context: defaultRecommendationContext(),
      creators,
      limit: 6,
    });

    const measured = metricsResult.data
      ? ((metricsResult.data as { measured?: CreatorHubData["analytics"]["measured"] }).measured || demo.analytics[0].measured)
      : demo.analytics[0].measured;

    const estimated = metricsResult.data
      ? ((metricsResult.data as { estimated?: CreatorHubData["analytics"]["estimated"] }).estimated || demo.analytics[0].estimated)
      : demo.analytics[0].estimated;

    return {
      creators,
      campaigns: (campaignsResult.data as CreatorCampaign[] | null) || [],
      pipeline: (pipelineResult.data as CreatorPipelineRecord[] | null) || [],
      submissions: (submissionsResult.data as CreatorSubmission[] | null) || [],
      ugcAssets: (ugcResult.data as CreatorUgcAsset[] | null) || [],
      recommendations,
      activity: ((activityResult.data as Array<{ id: string; event_type: string; summary: string; created_at: string }> | null) || []).map((row) => ({
        id: row.id,
        summary: row.summary,
        eventType: row.event_type,
        createdAt: row.created_at,
      })),
      analytics: {
        measured,
        estimated,
        isDemo: false,
      },
      isDemo: false,
    };
  } catch {
    return buildDemoBundle(input.workspaceId, input.userId);
  }
}

function buildDemoBundle(workspaceId: string, userId: string): CreatorHubData {
  const demo = buildCreatorDemoData(workspaceId, userId);
  return {
    creators: demo.creators,
    campaigns: demo.campaigns,
    pipeline: demo.pipeline,
    submissions: demo.submissions,
    ugcAssets: demo.ugcAssets,
    recommendations: buildCreatorRecommendations({ context: defaultRecommendationContext(), creators: demo.creators, limit: 6 }),
    activity: demo.activity.map((item) => ({
      id: item.id,
      summary: item.summary,
      eventType: item.eventType,
      createdAt: item.createdAt,
    })),
    analytics: {
      measured: demo.analytics[0].measured,
      estimated: demo.analytics[0].estimated,
      isDemo: true,
    },
    isDemo: true,
  };
}
