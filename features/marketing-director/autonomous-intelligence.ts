import type { DailyBrief } from "@/features/marketing-director/daily-brief-rules";
import type { MarketingScoreResult, MarketingScoreTrend } from "@/features/marketing-director/marketing-score-rules";
import type { MarketingMemorySignal } from "@/features/marketing-director/marketing-memory";

export type AutonomousRecommendation = {
  id: string;
  title: string;
  why: string;
  businessImpact: string;
  confidence: number;
  estimatedEffort: string;
  expectedOutcome: string;
  approvalStatus: "approval_required" | "ready_for_review" | "scheduled";
  nextWorkflow: string;
  roiPriority: "critical" | "high" | "medium" | "low";
  crossChannelPlan: string[];
  source: "trend" | "performance" | "memory" | "coverage";
};

export type ExecutiveOpportunityRisk = {
  biggestOpportunity: string;
  biggestRisk: string;
};

export type AutonomousIntelligenceInput = {
  workspaceId: string;
  brief: DailyBrief;
  score: MarketingScoreResult;
  scoreTrend: MarketingScoreTrend;
  memorySignals: MarketingMemorySignal[];
  metrics: {
    activeCampaigns: number;
    scheduledPosts: number;
    draftsAwaitingApproval: number;
    connectedChannels: number;
    recentScheduledPosts24h: number;
    revenueLast30Days: number | null;
    impressionsLast30Days: number;
    clicksLast30Days: number;
    engagementsLast30Days: number;
    spendLast30Days: number;
  };
};

function confidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function id(prefix: string, workspaceId: string): string {
  const token = Math.abs(
    Array.from(`${workspaceId}:${prefix}`).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) | 0, 17),
  ).toString(36);
  return `${prefix}_${token}`;
}

function hasSignal(signals: MarketingMemorySignal[], key: MarketingMemorySignal["key"]): MarketingMemorySignal | null {
  return signals.find((signal) => signal.key === key) || null;
}

export function buildExecutiveOpportunityRisk(input: AutonomousIntelligenceInput): ExecutiveOpportunityRisk {
  const highest = input.brief.performingWell[0] || "Repurpose top-performing content across channels.";
  const risk = input.brief.needsAttention[0] || "Pipeline velocity may slow without additional approved content.";
  return {
    biggestOpportunity: highest,
    biggestRisk: risk,
  };
}

export function buildAutonomousRecommendations(
  input: AutonomousIntelligenceInput,
): AutonomousRecommendation[] {
  const results: AutonomousRecommendation[] = [];
  const today = new Date().toISOString();

  if (input.scoreTrend.available && input.scoreTrend.direction === "down" && Math.abs(input.scoreTrend.delta) >= 3) {
    results.push({
      id: id("score_recovery", input.workspaceId),
      title: `Marketing score declined ${Math.abs(input.scoreTrend.delta).toFixed(1)} points`,
      why: "The latest score snapshot has a measurable negative trend compared with the previous period.",
      businessImpact: "Prevents continued performance decay and protects conversion pipeline quality.",
      confidence: confidence((input.brief.confidence + input.score.confidence) / 2),
      estimatedEffort: "45-60 min",
      expectedOutcome: "Recover score momentum within 7 days through high-priority fixes.",
      approvalStatus: "approval_required",
      nextWorkflow: "Open Marketing Score breakdown and execute the top two critical actions.",
      roiPriority: "critical",
      crossChannelPlan: [
        "Promote best-performing owned content into paid distribution.",
        "Repurpose strongest social post into email and short-form video.",
      ],
      source: "trend",
    });
  }

  if (input.metrics.recentScheduledPosts24h === 0 && input.metrics.scheduledPosts === 0) {
    results.push({
      id: id("pipeline_idle", input.workspaceId),
      title: "No scheduled content activity detected",
      why: "No scheduled-post updates were recorded in the last 24 hours and no upcoming scheduled posts are present.",
      businessImpact: "Reduces risk of channel silence and audience decay.",
      confidence: confidence(input.brief.confidence),
      estimatedEffort: "30-45 min",
      expectedOutcome: "Restore consistent publishing cadence for the next 3-5 days.",
      approvalStatus: "ready_for_review",
      nextWorkflow: "Generate five cross-channel posts from strongest existing asset and queue approvals.",
      roiPriority: "high",
      crossChannelPlan: [
        "Blog to Email + Instagram carousel + LinkedIn post.",
        "Top social clip to TikTok + YouTube Shorts.",
      ],
      source: "performance",
    });
  }

  if (input.metrics.clicksLast30Days > 0 && input.metrics.impressionsLast30Days > 0) {
    const ctr = input.metrics.clicksLast30Days / input.metrics.impressionsLast30Days;
    if (ctr < 0.01) {
      results.push({
        id: id("ctr_recovery", input.workspaceId),
        title: "Click-through rate is below baseline",
        why: `Estimated CTR is ${(ctr * 100).toFixed(2)}% across connected snapshots, below healthy threshold.` ,
        businessImpact: "Improves conversion funnel entry point and campaign efficiency.",
        confidence: confidence(Math.max(input.brief.confidence - 0.05, 0.4)),
        estimatedEffort: "60-90 min",
        expectedOutcome: "Increase CTR via creative refresh and channel-specific hooks.",
        approvalStatus: "approval_required",
        nextWorkflow: "Create three creative variants and run split scheduling by channel.",
        roiPriority: "high",
        crossChannelPlan: [
          "Repurpose highest engagement reel into TikTok and Shorts.",
          "Adapt best ad hook into email subject + hero line.",
        ],
        source: "performance",
      });
    }
  }

  const approvalSignal = hasSignal(input.memorySignals, "approval_pattern");
  if (approvalSignal) {
    results.push({
      id: id("approval_rhythm", input.workspaceId),
      title: "Use historical approval rhythm to speed execution",
      why: approvalSignal.insight,
      businessImpact: "Reduces cycle time and missed publishing windows.",
      confidence: confidence(approvalSignal.confidence),
      estimatedEffort: "15-20 min",
      expectedOutcome: "Faster movement from draft to approved schedule.",
      approvalStatus: "ready_for_review",
      nextWorkflow: "Batch-prepare approvals for the next content window.",
      roiPriority: "medium",
      crossChannelPlan: [
        "Approve one reusable narrative thread for all connected channels.",
      ],
      source: "memory",
    });
  }

  const reuseSignal = hasSignal(input.memorySignals, "cross_channel_reuse_bias");
  if (reuseSignal) {
    results.push({
      id: id("reuse_winner", input.workspaceId),
      title: "Maximize existing winners before creating net-new",
      why: reuseSignal.insight,
      businessImpact: "Increases output velocity while lowering creative production cost.",
      confidence: confidence(reuseSignal.confidence),
      estimatedEffort: "20-30 min",
      expectedOutcome: "More assets shipped from proven narratives in the same week.",
      approvalStatus: "ready_for_review",
      nextWorkflow: "Duplicate top-performing asset into 4 platform-specific variants.",
      roiPriority: "medium",
      crossChannelPlan: [
        "Winning social post to email teaser + landing update.",
        "Winning blog insight to carousel + short-form script.",
      ],
      source: "memory",
    });
  }

  if (input.metrics.connectedChannels < 2) {
    results.push({
      id: id("coverage_expand", input.workspaceId),
      title: "Expand channel coverage to unlock higher-confidence guidance",
      why: "Connected channel count is limited, reducing optimization surface area.",
      businessImpact: "Improves reliability of AI recommendations and growth opportunities.",
      confidence: confidence(Math.max(input.brief.confidence - 0.1, 0.35)),
      estimatedEffort: "30 min",
      expectedOutcome: "Better attribution and stronger cross-channel optimization signals.",
      approvalStatus: "approval_required",
      nextWorkflow: "Connect at least one additional distribution or analytics channel.",
      roiPriority: "medium",
      crossChannelPlan: [
        "Once connected, repurpose existing top content to the new channel within 24 hours.",
      ],
      source: "coverage",
    });
  }

  return results
    .sort((a, b) => {
      const rank: Record<AutonomousRecommendation["roiPriority"], number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      return rank[a.roiPriority] - rank[b.roiPriority] || b.confidence - a.confidence;
    })
    .slice(0, 8)
    .map((item) => ({
      ...item,
      expectedOutcome: `${item.expectedOutcome} (${today.slice(0, 10)})`,
    }));
}
