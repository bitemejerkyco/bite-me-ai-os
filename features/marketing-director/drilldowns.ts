import type { MarketingDirectorDashboard } from "@/features/marketing-director/dashboard";
import type { DataCoverageSource } from "@/features/marketing-director/data-coverage";

type MetricId = MarketingDirectorDashboard["cards"][number]["id"];

export type MetricDrilldown = {
  id: MetricId;
  title: string;
  value: string;
  explanation: string;
  calculation: string;
  contributingSources: DataCoverageSource[];
  missingSources: DataCoverageSource[];
  nextAction: {
    label: string;
    href: string;
  };
};

function byKeys(sources: DataCoverageSource[], keys: DataCoverageSource["key"][]) {
  return sources.filter((source) => keys.includes(source.key));
}

function missingFrom(sources: DataCoverageSource[]) {
  return sources.filter((source) => source.health === "missing" || source.health === "limited");
}

export function buildMetricDrilldown(
  dashboard: MarketingDirectorDashboard,
  id: MetricId,
): MetricDrilldown {
  const card = dashboard.cards.find((item) => item.id === id);
  if (!card) {
    throw new Error(`METRIC_NOT_FOUND:${id}`);
  }

  const coverage = dashboard.dataCoverage.sources;

  if (id === "marketing_score") {
    const contributingSources = byKeys(coverage, [
      "workspace_profile",
      "brand_setup",
      "content_library",
      "calendar",
      "social_analytics",
      "revenue_tracking",
      "ai_usage",
    ]);
    return {
      id,
      title: "Marketing Score",
      value: card.value,
      explanation:
        "The Marketing Score blends brand foundation, content readiness, campaign activity, analytics coverage, and channel health.",
      calculation:
        "Weighted 0-100 score from category rules in the marketing score engine. Each category contributes only when supporting records exist.",
      contributingSources,
      missingSources: missingFrom(contributingSources),
      nextAction: {
        label: "Address low score categories",
        href: "/analytics/marketing-score",
      },
    };
  }

  if (id === "marketing_health") {
    const contributingSources = byKeys(coverage, [
      "workspace_profile",
      "content_library",
      "calendar",
      "social_analytics",
      "revenue_tracking",
      "tiktok",
      "amazon_ads",
    ]);
    return {
      id,
      title: "Marketing Health",
      value: card.value,
      explanation:
        "Marketing Health reflects the current score status band and confidence quality from active data sources.",
      calculation:
        "Status is derived from Marketing Score thresholds and adjusted confidence messaging from data coverage warnings.",
      contributingSources,
      missingSources: missingFrom(contributingSources),
      nextAction: {
        label: "Review top actions",
        href: "/",
      },
    };
  }

  if (id === "revenue_impact") {
    const contributingSources = byKeys(coverage, [
      "revenue_tracking",
      "social_analytics",
      "calendar",
    ]);
    return {
      id,
      title: "Revenue Impact",
      value: card.value,
      explanation:
        "Revenue impact reports connected conversion revenue from performance snapshots over the last 30 days.",
      calculation:
        "Sum of revenue fields from workspace performance snapshots within a rolling 30-day window. If no reliable records exist, revenue is marked unavailable.",
      contributingSources,
      missingSources: missingFrom(contributingSources),
      nextAction: {
        label: "Connect revenue-capable analytics",
        href: "/integrations",
      },
    };
  }

  if (id === "ai_confidence") {
    const contributingSources = coverage;
    const connected = coverage.filter((source) => source.health === "healthy").map((source) => source.label);
    const stale = coverage.filter((source) => source.health === "stale").map((source) => source.label);
    const missing = missingFrom(contributingSources).map((source) => source.label);
    const revenueUnavailable = coverage.some((source) => source.key === "revenue_tracking" && source.health !== "healthy");

    const explanationParts = [
      connected.length > 0
        ? `Confidence is supported by connected sources including ${connected.slice(0, 3).join(", ")}.`
        : "Confidence is limited because few healthy sources are connected.",
      missing.length > 0
        ? `Missing or limited sources include ${missing.slice(0, 4).join(", ")}.`
        : "No missing core sources were detected.",
      stale.length > 0
        ? `Stale sources: ${stale.slice(0, 3).join(", ")}.`
        : "No stale source signals were detected.",
      revenueUnavailable
        ? "Revenue or performance contribution remains incomplete from connected data."
        : "Revenue and performance coverage are available from connected data.",
    ];

    return {
      id,
      title: "AI Confidence",
      value: card.value,
      explanation: explanationParts.join(" "),
      calculation:
        "Confidence is derived from weighted source health across profile, content, channel, analytics, and usage records.",
      contributingSources,
      missingSources: missingFrom(contributingSources),
      nextAction: {
        label: "Improve data coverage",
        href: "/integrations",
      },
    };
  }

  if (id === "active_campaigns") {
    const contributingSources = byKeys(coverage, ["content_library", "calendar", "social_analytics"]);
    return {
      id,
      title: "Active Campaigns",
      value: card.value,
      explanation: "Active campaigns count records in ACTIVE status for this workspace.",
      calculation: "Count of campaign records where status is ACTIVE.",
      contributingSources,
      missingSources: missingFrom(contributingSources),
      nextAction: {
        label: "Review campaign performance",
        href: "/marketing/campaigns",
      },
    };
  }

  if (id === "content_awaiting_approval") {
    const contributingSources = byKeys(coverage, ["content_library", "calendar"]);
    return {
      id,
      title: "Content Awaiting Approval",
      value: card.value,
      explanation: "Approval queue includes draft content and scheduled posts waiting on approval.",
      calculation:
        "Count of content drafts in DRAFT plus scheduled posts in PENDING_APPROVAL.",
      contributingSources,
      missingSources: missingFrom(contributingSources),
      nextAction: {
        label: "Open approval queue",
        href: "/media?tab=CONTENT_DRAFTS",
      },
    };
  }

  if (id === "scheduled_posts") {
    const contributingSources = byKeys(coverage, ["calendar", "content_library", "tiktok"]);
    return {
      id,
      title: "Scheduled Posts",
      value: card.value,
      explanation: "Scheduled posts tracks upcoming and in-progress publication pipeline volume.",
      calculation:
        "Count of scheduled_posts rows in SCHEDULED, PUBLISHING, or DELIVERED_TO_INBOX status.",
      contributingSources,
      missingSources: missingFrom(contributingSources),
      nextAction: {
        label: "Open scheduled calendar",
        href: "/calendar?view=scheduled",
      },
    };
  }

  const contributingSources = byKeys(coverage, ["tiktok", "amazon_ads", "email_provider"]);
  return {
    id,
    title: "Connected Channels",
    value: card.value,
    explanation: "Connected channels counts currently connected distribution or analytics channels.",
    calculation: "Current count of connected channel integrations for this workspace.",
    contributingSources,
    missingSources: missingFrom(contributingSources),
    nextAction: {
      label: "Manage integrations",
      href: "/integrations",
    },
  };
}
