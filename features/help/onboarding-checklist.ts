import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { OnboardingChecklistStep } from "@/features/help/types";
import { detectProductsTable } from "@/features/marketing-director/data-coverage";

function completionPercentage(steps: OnboardingChecklistStep[]): number {
  if (steps.length === 0) return 0;
  const completed = steps.filter((step) => step.completed).length;
  return Math.round((completed / steps.length) * 100);
}

export async function loadOnboardingChecklist(workspaceId: string) {
  const admin = createAdminClient();
  const hasProducts = await detectProductsTable();

  const [workspaceResult, brandingResult, mediaResult, campaignsResult, draftsResult, approvedDraftsResult, scheduleResult, publishedResult, analyticsResult, integrationResult, productsResult] = await Promise.all([
    admin.from("workspaces").select("name,website,industry,primary_goal,audience,voice").eq("id", workspaceId).maybeSingle(),
    admin.from("workspace_branding_settings").select("logo_url").eq("workspace_id", workspaceId).maybeSingle(),
    admin.from("media_assets").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    admin.from("campaigns").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    admin.from("content_drafts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    admin.from("content_drafts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "APPROVED"),
    admin.from("scheduled_posts").select("id,status", { count: "exact" }).eq("workspace_id", workspaceId),
    admin.from("scheduled_posts").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "PUBLISHED"),
    admin.from("performance_snapshots").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    admin.from("integration_connections").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("state", "CONNECTED"),
    hasProducts ? admin.from("products").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId) : Promise.resolve({ count: 0, error: null, data: null }),
  ]);

  const workspace = (workspaceResult.data as {
    name?: string | null;
    website?: string | null;
    industry?: string | null;
    primary_goal?: string | null;
    audience?: string | null;
    voice?: string | null;
  } | null) || null;

  const scheduledRows = (scheduleResult.data as Array<{ status?: string | null }> | null) || [];
  const hasScheduled = scheduledRows.length > 0;
  const hasPublishedOrPublishing = scheduledRows.some((row) => ["PUBLISHED", "PUBLISHING", "DELIVERED_TO_INBOX"].includes(String(row.status || "")));

  const steps: OnboardingChecklistStep[] = [
    {
      id: "business-profile",
      title: "Complete business profile",
      completed: Boolean(workspace?.name && workspace?.website && workspace?.primary_goal && workspace?.audience && workspace?.voice),
      description: "Save the business profile used by recommendations and content generation.",
      estimatedMinutes: 8,
      href: "/onboarding",
    },
    {
      id: "industry-compliance",
      title: "Select industry and compliance mode",
      completed: Boolean(workspace?.industry),
      description: "Choose the correct industry so compliance-aware guidance stays realistic.",
      estimatedMinutes: 2,
      href: "/onboarding",
    },
    {
      id: "upload-logo",
      title: "Upload logo",
      completed: Boolean((brandingResult.data as { logo_url?: string | null } | null)?.logo_url),
      description: "Save a logo in Branding settings for a more complete brand foundation.",
      estimatedMinutes: 3,
      href: "/settings/branding",
    },
    {
      id: "first-media-asset",
      title: "Upload first media asset",
      completed: Number(mediaResult.count || 0) > 0,
      description: "Add at least one brand asset or piece of reusable media.",
      estimatedMinutes: 3,
      href: "/media",
    },
    {
      id: "product-or-service",
      title: "Add product or service",
      completed: Number((productsResult as { count?: number | null }).count || 0) > 0,
      description: hasProducts ? "Use available product records to improve content specificity." : "Product catalog support is limited in this environment, so this step may remain blocked.",
      estimatedMinutes: 4,
      href: "/products",
    },
    {
      id: "connect-first-channel",
      title: "Connect first channel",
      completed: Number(integrationResult.count || 0) > 0,
      description: "Connect a live channel or analytics provider.",
      estimatedMinutes: 5,
      href: "/integrations",
    },
    {
      id: "first-marketing-plan",
      title: "Generate first marketing plan",
      completed: Number(campaignsResult.count || 0) > 0,
      description: "Save a campaign plan or structured marketing plan.",
      estimatedMinutes: 4,
      href: "/marketing/campaigns",
    },
    {
      id: "first-content",
      title: "Generate first content",
      completed: Number(draftsResult.count || 0) > 0,
      description: "Create the first draft in AI Studio or the Marketing Director flow.",
      estimatedMinutes: 5,
      href: "/studio",
    },
    {
      id: "first-approved-draft",
      title: "Approve first draft",
      completed: Number(approvedDraftsResult.count || 0) > 0,
      description: "Approve at least one content draft so it can move to scheduling.",
      estimatedMinutes: 3,
      href: "/approvals",
    },
    {
      id: "first-scheduled-post",
      title: "Schedule first post",
      completed: hasScheduled,
      description: "Add an approved draft to the publishing calendar.",
      estimatedMinutes: 3,
      href: "/calendar",
    },
    {
      id: "first-published-post",
      title: "Publish first post",
      completed: hasPublishedOrPublishing || Number(publishedResult.count || 0) > 0,
      description: "Move at least one item far enough through the queue to publish or hand off.",
      estimatedMinutes: 2,
      href: "/publishing-queue",
    },
    {
      id: "first-analytics-result",
      title: "Review first analytics result",
      completed: Number(analyticsResult.count || 0) > 0,
      description: "Review an analytics or performance snapshot after execution begins.",
      estimatedMinutes: 3,
      href: "/analytics",
    },
  ];

  const currentStep = steps.find((step) => !step.completed) || null;
  const remainingMinutes = steps.filter((step) => !step.completed).reduce((sum, step) => sum + step.estimatedMinutes, 0);

  return {
    steps,
    percentage: completionPercentage(steps),
    currentStep,
    remainingMinutes,
  };
}
