import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getEffectiveEntitlements } from "@/features/billing/entitlements";
import { listFeatureFlags } from "@/features/admin/feature-flags";
import { listSystemSettings } from "@/features/admin/settings";
import { loadPlatformHealth } from "@/features/admin/health";
import { loadAdminCosts } from "@/features/admin/costs";

type WorkspaceRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  account_type_id: string | null;
  pricing_plan_id: string | null;
  billing_status: string | null;
  billing_exempt: boolean;
  trial_ends_at: string | null;
  suspended_at: string | null;
  suspension_reason: string | null;
  metadata: Record<string, unknown> | null;
};

type AccountTypeRow = { id: string; key: string; display_name: string };
type PlanRow = {
  id: string;
  key: string;
  name: string;
  monthly_price_cents: number;
  annual_price_cents: number;
  currency: string;
  is_public: boolean;
  is_active: boolean;
  lifecycle_state: string;
  stripe_monthly_price_id: string | null;
  stripe_annual_price_id: string | null;
  metadata: Record<string, unknown> | null;
  sort_order: number;
  description: string | null;
};
type MembershipRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  system_role: string;
  created_at: string;
  updated_at: string;
};

type AdminAuditRow = {
  id: string;
  actor_user_id: string | null;
  target_account_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  previous_value: unknown;
  new_value: unknown;
  reason: string | null;
  created_at: string;
};

type AccountOverrideListRow = {
  id: string;
  entitlement_key: string;
  override_mode: string;
  value: unknown;
  reason: string | null;
  created_at: string;
};

function parseString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function paginate<T>(items: T[], page: number, pageSize: number) {
  const currentPage = Math.max(1, page || 1);
  const perPage = Math.max(1, Math.min(50, pageSize || 10));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = (currentPage - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    page: currentPage,
    pageSize: perPage,
    total,
    totalPages,
  };
}

async function loadReferenceData() {
  const admin = createAdminClient();
  const [workspacesResult, accountTypesResult, plansResult, membershipsResult, profilesResult, draftsResult, scheduledPostsResult, aiRunsResult, mediaAssetsResult, videoTransactionsResult] = await Promise.all([
    admin.from("workspaces").select("id,name,created_at,updated_at,account_type_id,pricing_plan_id,billing_status,billing_exempt,trial_ends_at,suspended_at,suspension_reason,metadata").order("created_at", { ascending: false }),
    admin.from("account_types").select("id,key,display_name"),
    admin.from("pricing_plans").select("id,key,name,description,monthly_price_cents,annual_price_cents,currency,is_public,is_active,lifecycle_state,stripe_monthly_price_id,stripe_annual_price_id,metadata,sort_order").order("sort_order", { ascending: true }),
    admin.from("workspace_memberships").select("id,workspace_id,user_id,role,status,created_at,updated_at"),
    admin.from("profiles").select("user_id,full_name,system_role,created_at,updated_at"),
    admin.from("content_drafts").select("workspace_id,created_at,created_by"),
    admin.from("scheduled_posts").select("workspace_id,created_at,status,created_by"),
    admin.from("ai_generation_runs").select("workspace_id,created_at,created_by,model"),
    admin.from("media_assets").select("workspace_id,size_bytes,created_at"),
    admin.from("video_credit_transactions").select("workspace_id,kind,credits_delta,estimated_provider_cost_cents,created_at,actor_user_id,metadata"),
  ]);

  for (const result of [workspacesResult, accountTypesResult, plansResult, membershipsResult, profilesResult, draftsResult, scheduledPostsResult, aiRunsResult, mediaAssetsResult, videoTransactionsResult]) {
    if (result.error) {
      throw new Error(`ADMIN_CONSOLE_DATA_FAILED:${result.error.message}`);
    }
  }

  return {
    workspaces: (workspacesResult.data as WorkspaceRow[] | null) || [],
    accountTypes: (accountTypesResult.data as AccountTypeRow[] | null) || [],
    plans: (plansResult.data as PlanRow[] | null) || [],
    memberships: (membershipsResult.data as MembershipRow[] | null) || [],
    profiles: (profilesResult.data as ProfileRow[] | null) || [],
    drafts: ((draftsResult.data as Array<Record<string, unknown>> | null) || []).map((row) => ({
      workspaceId: parseString(row.workspace_id),
      createdAt: parseString(row.created_at),
      createdBy: parseString(row.created_by),
    })),
    scheduledPosts: ((scheduledPostsResult.data as Array<Record<string, unknown>> | null) || []).map((row) => ({
      workspaceId: parseString(row.workspace_id),
      createdAt: parseString(row.created_at),
      status: parseString(row.status),
      createdBy: parseString(row.created_by),
    })),
    aiRuns: ((aiRunsResult.data as Array<Record<string, unknown>> | null) || []).map((row) => ({
      workspaceId: parseString(row.workspace_id),
      createdAt: parseString(row.created_at),
      createdBy: parseString(row.created_by),
      model: parseString(row.model),
    })),
    mediaAssets: ((mediaAssetsResult.data as Array<Record<string, unknown>> | null) || []).map((row) => ({
      workspaceId: parseString(row.workspace_id),
      sizeBytes: Number(row.size_bytes || 0),
      createdAt: parseString(row.created_at),
    })),
    videoTransactions: ((videoTransactionsResult.data as Array<Record<string, unknown>> | null) || []).map((row) => ({
      workspaceId: parseString(row.workspace_id),
      kind: parseString(row.kind),
      creditsDelta: Number(row.credits_delta || 0),
      estimatedProviderCostCents: Number(row.estimated_provider_cost_cents || 0),
      createdAt: parseString(row.created_at),
      actorUserId: parseString(row.actor_user_id),
      metadata: (row.metadata as Record<string, unknown> | null) || {},
    })),
  };
}

function buildAccountRows(reference: Awaited<ReturnType<typeof loadReferenceData>>) {
  const accountTypeById = new Map(reference.accountTypes.map((row) => [row.id, row]));
  const planById = new Map(reference.plans.map((row) => [row.id, row]));

  return reference.workspaces.map((workspace) => {
    const membershipRows = reference.memberships.filter(
      (membership) => membership.workspace_id === workspace.id,
    );
    const aiUsage = reference.aiRuns.filter((row) => row.workspaceId === workspace.id).length;
    const videoUsage = reference.videoTransactions
      .filter((row) => row.workspaceId === workspace.id && row.kind === "VIDEO_RENDER")
      .reduce((sum, row) => sum + Math.max(0, -row.creditsDelta), 0);
    const storageUsage = reference.mediaAssets
      .filter((row) => row.workspaceId === workspace.id)
      .reduce((sum, row) => sum + row.sizeBytes, 0);
    const activityDates = [
      workspace.updated_at,
      ...reference.drafts
        .filter((row) => row.workspaceId === workspace.id)
        .map((row) => row.createdAt),
      ...reference.scheduledPosts
        .filter((row) => row.workspaceId === workspace.id)
        .map((row) => row.createdAt),
      ...reference.aiRuns
        .filter((row) => row.workspaceId === workspace.id)
        .map((row) => row.createdAt),
      ...reference.videoTransactions
        .filter((row) => row.workspaceId === workspace.id)
        .map((row) => row.createdAt),
    ].filter(Boolean);
    const lastActivity = activityDates.sort().at(-1) || workspace.updated_at;
    const accountType = workspace.account_type_id
      ? accountTypeById.get(workspace.account_type_id)
      : null;
    const plan = workspace.pricing_plan_id
      ? planById.get(workspace.pricing_plan_id)
      : null;

    return {
      id: workspace.id,
      name: workspace.name,
      createdAt: workspace.created_at,
      updatedAt: workspace.updated_at,
      accountTypeKey: accountType?.key || null,
      accountTypeLabel: accountType?.display_name || "Unassigned",
      planId: plan?.id || null,
      planKey: plan?.key || null,
      planName: plan?.name || "No plan",
      billingStatus: workspace.billing_status || "UNCONFIGURED",
      billingExempt: workspace.billing_exempt,
      trialEndsAt: workspace.trial_ends_at,
      suspendedAt: workspace.suspended_at,
      suspensionReason: workspace.suspension_reason,
      memberCount: membershipRows.length,
      aiUsage,
      videoUsage,
      storageUsage,
      lastActivity,
      status: workspace.suspended_at ? "Suspended" : workspace.billing_status || "Active",
      metadata: workspace.metadata || {},
    };
  });
}

export async function loadAdminOverview() {
  const admin = createAdminClient();
  const reference = await loadReferenceData();
  const accountRows = buildAccountRows(reference);
  const usersResponse = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersResponse.error) {
    throw new Error(`ADMIN_USERS_OVERVIEW_FAILED:${usersResponse.error.message}`);
  }
  const users = usersResponse.data.users || [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const withinDays = (value: string | null | undefined, days: number) => {
    if (!value) return false;
    return now - new Date(value).getTime() <= days * dayMs;
  };

  const costs = await loadAdminCosts();
  const health = await loadPlatformHealth();
  const recentAuditLogsResult = await admin
    .from("admin_audit_logs")
    .select("id,action,resource_type,resource_id,reason,created_at")
    .order("created_at", { ascending: false })
    .limit(8);
  if (recentAuditLogsResult.error) {
    throw new Error(`ADMIN_AUDIT_OVERVIEW_FAILED:${recentAuditLogsResult.error.message}`);
  }

  const storageUsage = accountRows.reduce((sum, row) => sum + row.storageUsage, 0);
  const scheduledPostsCreated = reference.scheduledPosts.length;
  const failedScheduledPosts = reference.scheduledPosts.filter(
    (row) => row.status === "FAILED",
  ).length;
  const videoUsageToday = reference.videoTransactions
    .filter((row) => withinDays(row.createdAt, 1) && row.kind === "VIDEO_RENDER")
    .reduce((sum, row) => sum + Math.max(0, -row.creditsDelta), 0);
  const videoUsageMonth = reference.videoTransactions
    .filter((row) => withinDays(row.createdAt, 30) && row.kind === "VIDEO_RENDER")
    .reduce((sum, row) => sum + Math.max(0, -row.creditsDelta), 0);

  const activeAccounts = accountRows.filter((row) => !row.suspendedAt).length;
  const trialAccounts = accountRows.filter(
    (row) => row.accountTypeKey === "trial" || row.billingStatus === "TRIALING",
  ).length;
  const paidAccounts = accountRows.filter((row) => row.billingStatus === "ACTIVE").length;
  const enterpriseAccounts = accountRows.filter((row) => row.accountTypeKey === "enterprise").length;
  const agencyAccounts = accountRows.filter((row) => row.accountTypeKey === "agency").length;
  const suspendedAccounts = accountRows.filter((row) => Boolean(row.suspendedAt)).length;
  const billingExemptAccounts = accountRows.filter((row) => row.billingExempt).length;

  const mrrCents = accountRows
    .filter((row) => row.billingStatus === "ACTIVE" && !row.billingExempt)
    .reduce((sum, row) => {
      const plan = reference.plans.find((item) => item.id === row.planId);
      return sum + Number(plan?.monthly_price_cents || 0);
    }, 0);

  return {
    customerMetrics: {
      totalAccounts: accountRows.length,
      activeAccounts,
      trialAccounts,
      paidAccounts,
      enterpriseAccounts,
      agencyAccounts,
      suspendedAccounts,
      newSignupsToday: users.filter((user) => withinDays(user.created_at, 1)).length,
      newSignupsWeek: users.filter((user) => withinDays(user.created_at, 7)).length,
      newSignupsMonth: users.filter((user) => withinDays(user.created_at, 30)).length,
    },
    userMetrics: {
      totalRegisteredUsers: users.length,
      activeUsers24Hours: users.filter((user) => withinDays(user.last_sign_in_at, 1)).length,
      activeUsers7Days: users.filter((user) => withinDays(user.last_sign_in_at, 7)).length,
      activeUsers30Days: users.filter((user) => withinDays(user.last_sign_in_at, 30)).length,
      averageUsersPerAccount: accountRows.length
        ? Number((reference.memberships.length / accountRows.length).toFixed(2))
        : 0,
    },
    revenueMetrics: {
      mrrCents,
      arrCents: mrrCents * 12,
      trialToPaidConversion: null,
      churn: null,
      failedPayments: accountRows.filter((row) => row.billingStatus === "PAST_DUE").length,
      billingExemptAccounts,
    },
    usageMetrics: {
      aiCreditsConsumedToday: costs.events.filter((event) => withinDays(event.createdAt, 1)).reduce((sum, event) => sum + event.creditsCharged, 0),
      aiCreditsConsumedMonth: costs.events.filter((event) => withinDays(event.createdAt, 30)).reduce((sum, event) => sum + event.creditsCharged, 0),
      videoCreditsConsumedToday: videoUsageToday,
      videoCreditsConsumedMonth: videoUsageMonth,
      generatedVideos: reference.videoTransactions.filter((row) => row.kind === "VIDEO_RENDER").length,
      generatedImagesOrContent: reference.aiRuns.length,
      failedGenerations: costs.aiSummary.failedEvents,
      creditsRefunded: costs.creditsRefunded,
      storageUsage,
      bandwidthUsage: null,
      scheduledPostsCreated,
      failedScheduledPosts,
    },
    systemMetrics: {
      health,
      lastSuccessfulDeployment: process.env.VERCEL_GIT_COMMIT_SHA
        ? { commit: process.env.VERCEL_GIT_COMMIT_SHA }
        : null,
      recentErrors: reference.scheduledPosts
        .filter((row) => row.status === "FAILED")
        .slice(0, 5),
      recentAuditActions:
        (recentAuditLogsResult.data as Array<
          Pick<
            AdminAuditRow,
            "id" | "action" | "resource_type" | "resource_id" | "reason" | "created_at"
          >
        > | null) || [],
    },
  };
}

export async function listAdminAccounts(filters: {
  search?: string | null;
  accountType?: string | null;
  planKey?: string | null;
  billingStatus?: string | null;
  status?: string | null;
  sort?: string | null;
  page?: number;
  pageSize?: number;
}) {
  const rows = buildAccountRows(await loadReferenceData());
  const search = (filters.search || "").trim().toLowerCase();
  const filtered = rows
    .filter((row) => !search || row.name.toLowerCase().includes(search))
    .filter((row) => !filters.accountType || row.accountTypeKey === filters.accountType)
    .filter((row) => !filters.planKey || row.planKey === filters.planKey)
    .filter((row) => !filters.billingStatus || row.billingStatus === filters.billingStatus)
    .filter((row) => {
      if (!filters.status) return true;
      if (filters.status === "active") return !row.suspendedAt;
      if (filters.status === "suspended") return Boolean(row.suspendedAt);
      if (filters.status === "trial") return row.billingStatus === "TRIALING" || row.accountTypeKey === "trial";
      if (filters.status === "paid") return row.billingStatus === "ACTIVE";
      if (filters.status === "billing_exempt") return row.billingExempt;
      return true;
    });

  filtered.sort((left, right) => {
    switch (filters.sort) {
      case "oldest":
        return left.createdAt.localeCompare(right.createdAt);
      case "most_active":
        return right.lastActivity.localeCompare(left.lastActivity);
      case "highest_usage":
        return right.aiUsage + right.videoUsage - (left.aiUsage + left.videoUsage);
      case "newest":
      default:
        return right.createdAt.localeCompare(left.createdAt);
    }
  });

  return paginate(filtered, filters.page || 1, filters.pageSize || 10);
}

export async function getAdminAccountDetail(accountId: string) {
  const reference = await loadReferenceData();
  const account = buildAccountRows(reference).find((row) => row.id === accountId) || null;
  if (!account) {
    throw new Error("ACCOUNT_NOT_FOUND:Account was not found.");
  }
  const admin = createAdminClient();
  const usersResponse = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersResponse.error) {
    throw new Error(`ACCOUNT_USERS_LOOKUP_FAILED:${usersResponse.error.message}`);
  }
  const userById = new Map(usersResponse.data.users.map((user) => [user.id, user]));
  const members = reference.memberships
    .filter((membership) => membership.workspace_id === accountId)
    .map((membership) => {
      const profile = reference.profiles.find((row) => row.user_id === membership.user_id);
      const user = userById.get(membership.user_id);
      return {
        id: membership.id,
        userId: membership.user_id,
        role: membership.role,
        status: membership.status,
        fullName: profile?.full_name || user?.user_metadata?.full_name || "Unknown user",
        email: user?.email || null,
        lastSignInAt: user?.last_sign_in_at || null,
      };
    });
  const entitlements = await getEffectiveEntitlements(accountId);
  const overridesResult = await admin
    .from("account_entitlement_overrides")
    .select("id,entitlement_key,override_mode,value,reason,created_at")
    .eq("account_id", accountId)
    .order("entitlement_key", { ascending: true });
  const auditResult = await admin
    .from("admin_audit_logs")
    .select("id,actor_user_id,action,resource_type,resource_id,previous_value,new_value,reason,created_at")
    .eq("target_account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (overridesResult.error) {
    throw new Error(`ACCOUNT_OVERRIDE_LIST_FAILED:${overridesResult.error.message}`);
  }
  if (auditResult.error) {
    throw new Error(`ACCOUNT_AUDIT_LIST_FAILED:${auditResult.error.message}`);
  }
  return {
    account,
    members,
    entitlements,
    overrides: (overridesResult.data as AccountOverrideListRow[] | null) || [],
    integrations: {
      tiktokConfigured: Boolean(process.env.TIKTOK_CLIENT_KEY),
      amazonAdsConfigured: Boolean(process.env.AMAZON_ADS_CLIENT_ID),
    },
    recentActivity: [
      ...reference.aiRuns.filter((row) => row.workspaceId === accountId).map((row) => ({ type: "ai_generation", at: row.createdAt, detail: row.model })),
      ...reference.scheduledPosts.filter((row) => row.workspaceId === accountId).map((row) => ({ type: "scheduled_post", at: row.createdAt, detail: row.status })),
      ...reference.videoTransactions.filter((row) => row.workspaceId === accountId).map((row) => ({ type: row.kind.toLowerCase(), at: row.createdAt, detail: String(row.creditsDelta) })),
    ].sort((left, right) => right.at.localeCompare(left.at)).slice(0, 20),
    auditHistory: (auditResult.data as AdminAuditRow[] | null) || [],
  };
}

export async function listAdminUsers(filters: {
  search?: string | null;
  systemRole?: string | null;
  membershipRole?: string | null;
  accountId?: string | null;
  activity?: string | null;
  page?: number;
  pageSize?: number;
}) {
  const admin = createAdminClient();
  const reference = await loadReferenceData();
  const usersResponse = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersResponse.error) {
    throw new Error(`ADMIN_USERS_LIST_FAILED:${usersResponse.error.message}`);
  }
  const users = usersResponse.data.users.map((user) => {
    const profile = reference.profiles.find((row) => row.user_id === user.id);
    const memberships = reference.memberships.filter((membership) => membership.user_id === user.id);
    return {
      id: user.id,
      fullName: profile?.full_name || String(user.user_metadata?.full_name || "Unknown user"),
      email: user.email || "",
      systemRole: profile?.system_role || "CUSTOMER",
      memberships: memberships.map((membership) => ({
        id: membership.id,
        accountId: membership.workspace_id,
        role: membership.role,
        status: membership.status,
        accountName: reference.workspaces.find((workspace) => workspace.id === membership.workspace_id)?.name || membership.workspace_id,
      })),
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at || null,
    };
  });
  const search = (filters.search || "").trim().toLowerCase();
  const now = Date.now();
  const filtered = users.filter((user) => {
    if (search) {
      const haystack = `${user.fullName} ${user.email}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (filters.systemRole && user.systemRole !== filters.systemRole) return false;
    if (filters.membershipRole && !user.memberships.some((membership) => membership.role === filters.membershipRole)) return false;
    if (filters.accountId && !user.memberships.some((membership) => membership.accountId === filters.accountId)) return false;
    if (filters.activity === "active" && (!user.lastSignInAt || now - new Date(user.lastSignInAt).getTime() > 30 * 24 * 60 * 60 * 1000)) return false;
    if (filters.activity === "inactive" && user.lastSignInAt && now - new Date(user.lastSignInAt).getTime() <= 30 * 24 * 60 * 60 * 1000) return false;
    return true;
  });
  filtered.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return paginate(filtered, filters.page || 1, filters.pageSize || 10);
}

export async function getAdminUserDetail(userId: string) {
  const admin = createAdminClient();
  const reference = await loadReferenceData();
  const userResponse = await admin.auth.admin.getUserById(userId);
  if (userResponse.error || !userResponse.data.user) {
    throw new Error("USER_NOT_FOUND:User was not found.");
  }
  const user = userResponse.data.user;
  const profile = reference.profiles.find((row) => row.user_id === userId) || null;
  const memberships = reference.memberships
    .filter((membership) => membership.user_id === userId)
    .map((membership) => ({
      ...membership,
      accountName:
        reference.workspaces.find((workspace) => workspace.id === membership.workspace_id)?.name ||
        membership.workspace_id,
    }));
  const auditResult = await admin
    .from("admin_audit_logs")
    .select("id,actor_user_id,action,resource_type,resource_id,reason,created_at")
    .or(`resource_id.eq.${userId},actor_user_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(20);
  if (auditResult.error) {
    throw new Error(`USER_AUDIT_LIST_FAILED:${auditResult.error.message}`);
  }
  return {
    user: {
      id: user.id,
      email: user.email || "",
      fullName: profile?.full_name || String(user.user_metadata?.full_name || "Unknown user"),
      systemRole: profile?.system_role || "CUSTOMER",
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at || null,
    },
    memberships,
    recentActivity: [
      ...reference.aiRuns.filter((row) => row.createdBy === userId).map((row) => ({ type: "ai_generation", at: row.createdAt, detail: row.model })),
      ...reference.drafts.filter((row) => row.createdBy === userId).map((row) => ({ type: "draft", at: row.createdAt, detail: "content_draft" })),
      ...reference.scheduledPosts.filter((row) => row.createdBy === userId).map((row) => ({ type: "scheduled_post", at: row.createdAt, detail: row.status })),
      ...reference.videoTransactions.filter((row) => row.actorUserId === userId).map((row) => ({ type: row.kind.toLowerCase(), at: row.createdAt, detail: String(row.creditsDelta) })),
    ].sort((left, right) => right.at.localeCompare(left.at)).slice(0, 20),
    auditActions: (auditResult.data as AdminAuditRow[] | null) || [],
  };
}

export async function listAdminPlans() {
  const reference = await loadReferenceData();
  const admin = createAdminClient();
  const entitlementsResult = await admin
    .from("plan_entitlements")
    .select("plan_id,entitlement_key,value");
  if (entitlementsResult.error) {
    throw new Error(`PLAN_ENTITLEMENTS_LIST_FAILED:${entitlementsResult.error.message}`);
  }
  const entitlements = (entitlementsResult.data || []).reduce<Record<string, Record<string, unknown>>>((map, row) => {
    const planId = String((row as Record<string, unknown>).plan_id || "");
    map[planId] ||= {};
    map[planId][String((row as Record<string, unknown>).entitlement_key || "")] = (row as Record<string, unknown>).value;
    return map;
  }, {});

  return reference.plans.map((plan) => ({
    ...plan,
    description: plan.description || "",
    metadata: plan.metadata || {},
    entitlements: entitlements[plan.id] || {},
    accountCount: reference.workspaces.filter((workspace) => workspace.pricing_plan_id === plan.id).length,
  }));
}

export async function getAdminPlanDetail(planId: string) {
  const plan = (await listAdminPlans()).find((item) => item.id === planId) || null;
  if (!plan) {
    throw new Error("PLAN_NOT_FOUND:Pricing plan was not found.");
  }
  return plan;
}

export async function listAdminAuditLogs(filters: {
  search?: string | null;
  actor?: string | null;
  targetAccountId?: string | null;
  action?: string | null;
  resourceType?: string | null;
  from?: string | null;
  to?: string | null;
  page?: number;
  pageSize?: number;
}) {
  const admin = createAdminClient();
  const result = await admin
    .from("admin_audit_logs")
    .select("id,actor_user_id,target_account_id,action,resource_type,resource_id,previous_value,new_value,reason,created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (result.error) {
    throw new Error(`ADMIN_AUDIT_LIST_FAILED:${result.error.message}`);
  }
  const search = (filters.search || "").trim().toLowerCase();
  const filtered = ((result.data as Array<Record<string, unknown>> | null) || []).filter((row) => {
    if (filters.actor && String(row.actor_user_id || "") !== filters.actor) return false;
    if (filters.targetAccountId && String(row.target_account_id || "") !== filters.targetAccountId) return false;
    if (filters.action && String(row.action || "") !== filters.action) return false;
    if (filters.resourceType && String(row.resource_type || "") !== filters.resourceType) return false;
    if (filters.from && new Date(String(row.created_at)).getTime() < new Date(filters.from).getTime()) return false;
    if (filters.to && new Date(String(row.created_at)).getTime() > new Date(filters.to).getTime()) return false;
    if (search) {
      const haystack = `${row.action || ""} ${row.resource_type || ""} ${row.reason || ""} ${row.resource_id || ""}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
  return paginate(filtered, filters.page || 1, filters.pageSize || 20);
}

export async function loadAdminFeaturesPageData() {
  const [flags, accounts, settings] = await Promise.all([
    listFeatureFlags(),
    listAdminAccounts({ page: 1, pageSize: 200 }),
    listSystemSettings(),
  ]);
  const admin = createAdminClient();
  const overridesResult = await admin
    .from("account_feature_flag_overrides")
    .select("id,account_id,feature_flag_id,enabled,reason,created_at")
    .order("created_at", { ascending: false });
  if (overridesResult.error) {
    throw new Error(`FEATURE_FLAG_OVERRIDES_LIST_FAILED:${overridesResult.error.message}`);
  }
  return {
    flags,
    accounts: accounts.items,
    settings,
    overrides:
      (overridesResult.data as Array<{
        id: string;
        account_id: string;
        feature_flag_id: string;
        enabled: boolean;
        reason: string | null;
        created_at: string;
      }> | null) || [],
  };
}

export async function loadAdminSettingsPageData() {
  return listSystemSettings();
}

export async function loadAdminSystemPageData() {
  const [health, auditLogs, settings] = await Promise.all([
    loadPlatformHealth(),
    listAdminAuditLogs({ page: 1, pageSize: 8 }),
    listSystemSettings(),
  ]);
  return {
    health,
    auditLogs: auditLogs.items,
    settings,
  };
}

export async function loadAdminCostsPageData(filters: Parameters<typeof loadAdminCosts>[0]) {
  return loadAdminCosts(filters);
}