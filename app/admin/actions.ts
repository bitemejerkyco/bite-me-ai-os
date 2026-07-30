"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewerContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeAdminAuditEvent } from "@/features/admin/audit";
import {
  buildAccountTypeChange,
  buildBillingExemptionChange,
  buildCreditAdjustment,
  buildEntitlementOverride,
  buildPlanChange,
  buildSuspensionChange,
  buildTrialExpirationChange,
} from "@/features/admin/account-operation-rules";
import {
  assertCanRemoveSuperAdminAccess,
  requireSensitiveReason,
  requireSuperAdminMutationAccess,
} from "@/features/admin/operation-rules";
import { validateSystemSettingValue } from "@/features/admin/settings";

function withStatus(path: string, status: "notice" | "error", message: string) {
  const url = new URL(path, "https://postmotive.local");
  url.searchParams.set(status, message);
  return `${url.pathname}${url.search}`;
}

async function requireAdminActionViewer() {
  const viewer = await getViewerContext();
  requireSuperAdminMutationAccess({
    actorUserId: viewer.userId,
    actorIsSuperAdmin: viewer.isSuperAdmin,
  });
  return viewer;
}

function readString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function readBoolean(formData: FormData, key: string) {
  return ["true", "on", "1"].includes(String(formData.get(key) || "").toLowerCase());
}

async function performAction(
  returnPath: string,
  action: () => Promise<void>,
) {
  try {
    await action();
    redirect(withStatus(returnPath, "notice", "Saved successfully."));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    redirect(withStatus(returnPath, "error", message));
  }
}

export async function refreshSystemHealthAction(formData: FormData) {
  const returnPath = readString(formData, "returnPath") || "/admin/system";
  await requireAdminActionViewer();
  revalidatePath("/admin/system");
  redirect(withStatus(returnPath, "notice", "Health check data refreshed."));
}

export async function updateAccountTypeAction(formData: FormData) {
  const returnPath = readString(formData, "returnPath") || "/admin/accounts";
  await performAction(returnPath, async () => {
    const viewer = await requireAdminActionViewer();
    const admin = createAdminClient();
    const accountId = readString(formData, "accountId");
    const nextAccountTypeId = readString(formData, "accountTypeId");
    const nextAccountTypeKey = readString(formData, "accountTypeKey") as never;
    const reason = requireSensitiveReason(readString(formData, "reason"));
    const current = await admin
      .from("workspaces")
      .select("account_type:account_types(key)")
      .eq("id", accountId)
      .maybeSingle();
    if (current.error) throw new Error(current.error.message);
    const change = buildAccountTypeChange({
      currentAccountTypeKey:
        ((current.data as { account_type?: { key?: string | null } | null } | null)?.account_type?.key as never) ?? null,
      nextAccountTypeId,
      nextAccountTypeKey,
    });
    const { error } = await admin
      .from("workspaces")
      .update({ account_type_id: change.account_type_id } as never)
      .eq("id", accountId);
    if (error) throw new Error(error.message);
    await writeAdminAuditEvent({
      actorUserId: viewer.userId!,
      targetAccountId: accountId,
      action: "account_type_changed",
      resourceType: "account",
      resourceId: accountId,
      previousValue: change.previous,
      newValue: change.next,
      reason,
    });
    revalidatePath("/admin");
    revalidatePath("/admin/accounts");
    revalidatePath(`/admin/accounts/${accountId}`);
  });
}

export async function updateAccountPlanAction(formData: FormData) {
  const returnPath = readString(formData, "returnPath") || "/admin/accounts";
  await performAction(returnPath, async () => {
    const viewer = await requireAdminActionViewer();
    const admin = createAdminClient();
    const accountId = readString(formData, "accountId");
    const planId = readString(formData, "planId");
    const reason = requireSensitiveReason(readString(formData, "reason"));
    const current = await admin
      .from("workspaces")
      .select("pricing_plan_id")
      .eq("id", accountId)
      .maybeSingle();
    if (current.error) throw new Error(current.error.message);
    const change = buildPlanChange({
      currentPlanId:
        (current.data as { pricing_plan_id?: string | null } | null)?.pricing_plan_id ?? null,
      nextPlanId: planId,
    });
    const { error } = await admin
      .from("workspaces")
      .update({ pricing_plan_id: change.pricing_plan_id } as never)
      .eq("id", accountId);
    if (error) throw new Error(error.message);
    await writeAdminAuditEvent({
      actorUserId: viewer.userId!,
      targetAccountId: accountId,
      action: "account_plan_changed",
      resourceType: "account",
      resourceId: accountId,
      previousValue: change.previous,
      newValue: change.next,
      reason,
    });
    revalidatePath("/admin");
    revalidatePath("/admin/accounts");
    revalidatePath(`/admin/accounts/${accountId}`);
  });
}

export async function updateBillingExemptionAction(formData: FormData) {
  const returnPath = readString(formData, "returnPath") || "/admin/accounts";
  await performAction(returnPath, async () => {
    const viewer = await requireAdminActionViewer();
    const admin = createAdminClient();
    const accountId = readString(formData, "accountId");
    const nextBillingExempt = readBoolean(formData, "billingExempt");
    const reason = requireSensitiveReason(readString(formData, "reason"));
    const current = await admin
      .from("workspaces")
      .select("billing_exempt")
      .eq("id", accountId)
      .maybeSingle();
    if (current.error) throw new Error(current.error.message);
    const change = buildBillingExemptionChange({
      currentBillingExempt:
        Boolean((current.data as { billing_exempt?: boolean } | null)?.billing_exempt),
      nextBillingExempt,
    });
    const { error } = await admin
      .from("workspaces")
      .update({ billing_exempt: change.billing_exempt } as never)
      .eq("id", accountId);
    if (error) throw new Error(error.message);
    await writeAdminAuditEvent({
      actorUserId: viewer.userId!,
      targetAccountId: accountId,
      action: "account_billing_exemption_changed",
      resourceType: "account",
      resourceId: accountId,
      previousValue: change.previous,
      newValue: change.next,
      reason,
    });
    revalidatePath("/admin");
    revalidatePath("/admin/accounts");
    revalidatePath(`/admin/accounts/${accountId}`);
  });
}

export async function suspendAccountAction(formData: FormData) {
  const returnPath = readString(formData, "returnPath") || "/admin/accounts";
  await performAction(returnPath, async () => {
    const viewer = await requireAdminActionViewer();
    const admin = createAdminClient();
    const accountId = readString(formData, "accountId");
    const shouldSuspend = readString(formData, "mode") !== "reactivate";
    const reason = requireSensitiveReason(readString(formData, "reason"));
    const current = await admin
      .from("workspaces")
      .select("suspended_at")
      .eq("id", accountId)
      .maybeSingle();
    if (current.error) throw new Error(current.error.message);
    const change = buildSuspensionChange({
      suspendedAt:
        (current.data as { suspended_at?: string | null } | null)?.suspended_at ?? null,
      nextSuspended: shouldSuspend,
      reason,
    });
    const { error } = await admin
      .from("workspaces")
      .update({
        suspended_at: change.suspended_at,
        billing_status: change.billing_status ?? "ACTIVE",
        suspension_reason: change.suspension_reason,
      } as never)
      .eq("id", accountId);
    if (error) throw new Error(error.message);
    await writeAdminAuditEvent({
      actorUserId: viewer.userId!,
      targetAccountId: accountId,
      action: shouldSuspend ? "account_suspended" : "account_reactivated",
      resourceType: "account",
      resourceId: accountId,
      previousValue: change.previous,
      newValue: change.next,
      reason,
    });
    revalidatePath("/admin");
    revalidatePath("/admin/accounts");
    revalidatePath(`/admin/accounts/${accountId}`);
  });
}

export async function updateTrialExpirationAction(formData: FormData) {
  const returnPath = readString(formData, "returnPath") || "/admin/accounts";
  await performAction(returnPath, async () => {
    const viewer = await requireAdminActionViewer();
    const admin = createAdminClient();
    const accountId = readString(formData, "accountId");
    const reason = requireSensitiveReason(readString(formData, "reason"));
    const trialEndsAt = buildTrialExpirationChange(readString(formData, "trialEndsAt"));
    const { error } = await admin
      .from("workspaces")
      .update({ trial_ends_at: trialEndsAt } as never)
      .eq("id", accountId);
    if (error) throw new Error(error.message);
    await writeAdminAuditEvent({
      actorUserId: viewer.userId!,
      targetAccountId: accountId,
      action: "account_trial_expiration_changed",
      resourceType: "account",
      resourceId: accountId,
      previousValue: null,
      newValue: { trial_ends_at: trialEndsAt },
      reason,
    });
    revalidatePath("/admin/accounts");
    revalidatePath(`/admin/accounts/${accountId}`);
  });
}

export async function adjustAccountCreditsAction(formData: FormData) {
  const returnPath = readString(formData, "returnPath") || "/admin/accounts";
  await performAction(returnPath, async () => {
    const viewer = await requireAdminActionViewer();
    const admin = createAdminClient();
    const accountId = readString(formData, "accountId");
    const reason = requireSensitiveReason(readString(formData, "reason"));
    const delta = Number(readString(formData, "delta"));
    const current = await admin
      .from("video_credit_accounts")
      .select("balance_credits")
      .eq("workspace_id", accountId)
      .maybeSingle();
    if (current.error) throw new Error(current.error.message);
    const adjustment = buildCreditAdjustment({
      currentBalance:
        Number((current.data as { balance_credits?: number } | null)?.balance_credits || 0),
      delta,
    });
    const { error } = await admin
      .from("video_credit_accounts")
      .upsert({
        workspace_id: accountId,
        balance_credits: adjustment.nextBalance,
      } as never);
    if (error) throw new Error(error.message);
    const transactionError = await admin.from("video_credit_transactions").insert({
      workspace_id: accountId,
      actor_user_id: viewer.userId!,
      request_id: crypto.randomUUID(),
      kind: "ADMIN_ADJUSTMENT",
      credits_delta: delta,
      metadata: { reason },
    } as never);
    if (transactionError.error) throw new Error(transactionError.error.message);
    await writeAdminAuditEvent({
      actorUserId: viewer.userId!,
      targetAccountId: accountId,
      action: "account_credits_adjusted",
      resourceType: "account",
      resourceId: accountId,
      previousValue: { balance_credits: adjustment.nextBalance - delta },
      newValue: { balance_credits: adjustment.nextBalance, delta },
      reason,
    });
    revalidatePath("/admin/accounts");
    revalidatePath(`/admin/accounts/${accountId}`);
    revalidatePath("/admin/costs");
  });
}

export async function resetMonthlyCreditsAction(formData: FormData) {
  const returnPath = readString(formData, "returnPath") || "/admin/accounts";
  await performAction(returnPath, async () => {
    const viewer = await requireAdminActionViewer();
    const admin = createAdminClient();
    const accountId = readString(formData, "accountId");
    const reason = requireSensitiveReason(readString(formData, "reason"));
    const { error } = await admin
      .from("video_credit_accounts")
      .update({ monthly_used_credits: 0, period_started_at: new Date().toISOString().slice(0, 10) } as never)
      .eq("workspace_id", accountId);
    if (error) throw new Error(error.message);
    await writeAdminAuditEvent({
      actorUserId: viewer.userId!,
      targetAccountId: accountId,
      action: "account_monthly_credits_reset",
      resourceType: "account",
      resourceId: accountId,
      previousValue: null,
      newValue: { monthly_used_credits: 0 },
      reason,
    });
    revalidatePath(`/admin/accounts/${accountId}`);
    revalidatePath("/admin/costs");
  });
}

export async function saveEntitlementOverrideAction(formData: FormData) {
  const returnPath = readString(formData, "returnPath") || "/admin/accounts";
  await performAction(returnPath, async () => {
    const viewer = await requireAdminActionViewer();
    const admin = createAdminClient();
    const accountId = readString(formData, "accountId");
    const entitlementKey = readString(formData, "entitlementKey") as never;
    const overrideMode = readString(formData, "overrideMode") as never;
    const reason = requireSensitiveReason(readString(formData, "reason"));
    const rawValue = readString(formData, "value");
    const normalizedValue = rawValue
      ? rawValue === "true"
        ? true
        : rawValue === "false"
          ? false
          : Number.isFinite(Number(rawValue))
            ? Number(rawValue)
            : rawValue
      : null;
    const override = buildEntitlementOverride({
      entitlementKey,
      overrideMode,
      value: normalizedValue as never,
    });
    const { error } = await admin.from("account_entitlement_overrides").upsert({
      account_id: accountId,
      entitlement_key: override.entitlement_key,
      override_mode: override.override_mode,
      value: override.value,
      reason,
      created_by: viewer.userId!,
    } as never);
    if (error) throw new Error(error.message);
    await writeAdminAuditEvent({
      actorUserId: viewer.userId!,
      targetAccountId: accountId,
      action: "account_entitlement_override_saved",
      resourceType: "account_entitlement_override",
      resourceId: `${accountId}:${entitlementKey}`,
      previousValue: null,
      newValue: override,
      reason,
    });
    revalidatePath(`/admin/accounts/${accountId}`);
  });
}

export async function removeEntitlementOverrideAction(formData: FormData) {
  const returnPath = readString(formData, "returnPath") || "/admin/accounts";
  await performAction(returnPath, async () => {
    const viewer = await requireAdminActionViewer();
    const admin = createAdminClient();
    const accountId = readString(formData, "accountId");
    const entitlementKey = readString(formData, "entitlementKey");
    const reason = requireSensitiveReason(readString(formData, "reason"));
    const { error } = await admin
      .from("account_entitlement_overrides")
      .delete()
      .eq("account_id", accountId)
      .eq("entitlement_key", entitlementKey);
    if (error) throw new Error(error.message);
    await writeAdminAuditEvent({
      actorUserId: viewer.userId!,
      targetAccountId: accountId,
      action: "account_entitlement_override_removed",
      resourceType: "account_entitlement_override",
      resourceId: `${accountId}:${entitlementKey}`,
      previousValue: { entitlement_key: entitlementKey },
      newValue: null,
      reason,
    });
    revalidatePath(`/admin/accounts/${accountId}`);
  });
}

async function updateSystemRole(formData: FormData, nextSystemRole: string, actionName: string) {
  const returnPath = readString(formData, "returnPath") || "/admin/users";
  await performAction(returnPath, async () => {
    const viewer = await requireAdminActionViewer();
    const admin = createAdminClient();
    const userId = readString(formData, "userId");
    const reason = requireSensitiveReason(readString(formData, "reason"));
    const currentProfile = await admin
      .from("profiles")
      .select("system_role")
      .eq("user_id", userId)
      .maybeSingle();
    if (currentProfile.error) throw new Error(currentProfile.error.message);
    const superAdminCountResult = await admin
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("system_role", "SUPER_ADMIN");
    if (superAdminCountResult.error) throw new Error(superAdminCountResult.error.message);
    assertCanRemoveSuperAdminAccess({
      actorUserId: viewer.userId!,
      targetUserId: userId,
      nextSystemRole,
      activeSuperAdminCount: Number(superAdminCountResult.count || 0),
    });
    const { error } = await admin
      .from("profiles")
      .update({ system_role: nextSystemRole } as never)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    await writeAdminAuditEvent({
      actorUserId: viewer.userId!,
      action: actionName,
      resourceType: "user",
      resourceId: userId,
      previousValue: { system_role: (currentProfile.data as { system_role?: string } | null)?.system_role || null },
      newValue: { system_role: nextSystemRole },
      reason,
    });
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
  });
}

export async function grantSuperAdminAction(formData: FormData) {
  return updateSystemRole(formData, "SUPER_ADMIN", "user_granted_super_admin");
}

export async function removeSuperAdminAction(formData: FormData) {
  return updateSystemRole(formData, "CUSTOMER", "user_super_admin_removed");
}

export async function assignInternalAdminAction(formData: FormData) {
  return updateSystemRole(formData, "INTERNAL_ADMIN", "user_assigned_internal_admin");
}

export async function assignSupportAdminAction(formData: FormData) {
  return updateSystemRole(formData, "SUPPORT_ADMIN", "user_assigned_support_admin");
}

export async function returnToStandardUserAction(formData: FormData) {
  return updateSystemRole(formData, "CUSTOMER", "user_returned_to_standard_role");
}

export async function addUserToAccountAction(formData: FormData) {
  const returnPath = readString(formData, "returnPath") || "/admin/users";
  await performAction(returnPath, async () => {
    const viewer = await requireAdminActionViewer();
    const admin = createAdminClient();
    const userId = readString(formData, "userId");
    const accountId = readString(formData, "accountId");
    const role = readString(formData, "role") || "MEMBER";
    const reason = requireSensitiveReason(readString(formData, "reason"));
    const { error } = await admin.from("workspace_memberships").upsert({
      id: crypto.randomUUID(),
      workspace_id: accountId,
      user_id: userId,
      role,
      status: "ACTIVE",
    } as never);
    if (error) throw new Error(error.message);
    await writeAdminAuditEvent({
      actorUserId: viewer.userId!,
      targetAccountId: accountId,
      action: "account_membership_added",
      resourceType: "membership",
      resourceId: `${accountId}:${userId}`,
      previousValue: null,
      newValue: { role, user_id: userId, account_id: accountId },
      reason,
    });
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
    revalidatePath(`/admin/accounts/${accountId}`);
  });
}

export async function removeUserFromAccountAction(formData: FormData) {
  const returnPath = readString(formData, "returnPath") || "/admin/users";
  await performAction(returnPath, async () => {
    const viewer = await requireAdminActionViewer();
    const admin = createAdminClient();
    const userId = readString(formData, "userId");
    const accountId = readString(formData, "accountId");
    const reason = requireSensitiveReason(readString(formData, "reason"));
    const { error } = await admin
      .from("workspace_memberships")
      .delete()
      .eq("workspace_id", accountId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    await writeAdminAuditEvent({
      actorUserId: viewer.userId!,
      targetAccountId: accountId,
      action: "account_membership_removed",
      resourceType: "membership",
      resourceId: `${accountId}:${userId}`,
      previousValue: { user_id: userId, account_id: accountId },
      newValue: null,
      reason,
    });
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
    revalidatePath(`/admin/accounts/${accountId}`);
  });
}

export async function changeMembershipRoleAction(formData: FormData) {
  const returnPath = readString(formData, "returnPath") || "/admin/users";
  await performAction(returnPath, async () => {
    const viewer = await requireAdminActionViewer();
    const admin = createAdminClient();
    const userId = readString(formData, "userId");
    const accountId = readString(formData, "accountId");
    const role = readString(formData, "role");
    const reason = requireSensitiveReason(readString(formData, "reason"));
    const { error } = await admin
      .from("workspace_memberships")
      .update({ role } as never)
      .eq("workspace_id", accountId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    await writeAdminAuditEvent({
      actorUserId: viewer.userId!,
      targetAccountId: accountId,
      action: "account_membership_role_changed",
      resourceType: "membership",
      resourceId: `${accountId}:${userId}`,
      previousValue: null,
      newValue: { role },
      reason,
    });
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
    revalidatePath(`/admin/accounts/${accountId}`);
  });
}

export async function createPlanAction(formData: FormData) {
  const returnPath = readString(formData, "returnPath") || "/admin/plans";
  await performAction(returnPath, async () => {
    const viewer = await requireAdminActionViewer();
    const admin = createAdminClient();
    const key = readString(formData, "key");
    const name = readString(formData, "name");
    const reason = requireSensitiveReason(readString(formData, "reason"));
    if (!key || !name) {
      throw new Error("PLAN_INVALID:Plan key and name are required.");
    }
    const { data, error } = await admin
      .from("pricing_plans")
      .insert({
        key,
        name,
        description: readString(formData, "description"),
        monthly_price_cents: Number(readString(formData, "monthlyPriceCents") || 0),
        annual_price_cents: Number(readString(formData, "annualPriceCents") || 0),
        currency: readString(formData, "currency") || "USD",
        is_public: false,
        is_active: true,
        lifecycle_state: "draft",
        sort_order: Number(readString(formData, "sortOrder") || 0),
        metadata: { status: "draft" },
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const createdPlan = data as { id: string };
    await writeAdminAuditEvent({
      actorUserId: viewer.userId!,
      action: "pricing_plan_created",
      resourceType: "pricing_plan",
      resourceId: String(createdPlan.id),
      previousValue: null,
      newValue: { key, name },
      reason,
    });
    revalidatePath("/admin/plans");
  });
}

export async function updatePlanAction(formData: FormData) {
  const returnPath = readString(formData, "returnPath") || "/admin/plans";
  await performAction(returnPath, async () => {
    const viewer = await requireAdminActionViewer();
    const admin = createAdminClient();
    const planId = readString(formData, "planId");
    const reason = requireSensitiveReason(readString(formData, "reason"));
    const payload = {
      key: readString(formData, "key"),
      name: readString(formData, "name"),
      description: readString(formData, "description"),
      monthly_price_cents: Number(readString(formData, "monthlyPriceCents") || 0),
      annual_price_cents: Number(readString(formData, "annualPriceCents") || 0),
      currency: readString(formData, "currency") || "USD",
      is_public: readBoolean(formData, "isPublic"),
      is_active: readBoolean(formData, "isActive"),
      sort_order: Number(readString(formData, "sortOrder") || 0),
    };
    const current = await admin
      .from("pricing_plans")
      .select("key,name,monthly_price_cents,annual_price_cents,currency,is_public,is_active,sort_order")
      .eq("id", planId)
      .maybeSingle();
    if (current.error) throw new Error(current.error.message);
    const accountReferenceCount = await admin
      .from("workspaces")
      .select("id", { count: "exact", head: true })
      .eq("pricing_plan_id", planId);
    if (accountReferenceCount.error) throw new Error(accountReferenceCount.error.message);
    if (Number(accountReferenceCount.count || 0) > 0 && payload.key !== String((current.data as Record<string, unknown> | null)?.key || "")) {
      throw new Error("PLAN_KEY_LOCKED:Plan key cannot change while accounts reference this plan.");
    }
    const { error } = await admin.from("pricing_plans").update(payload as never).eq("id", planId);
    if (error) throw new Error(error.message);
    const entitlementKeys = [
      "monthly_ai_credits",
      "monthly_video_credits",
      "max_users",
      "max_workspaces",
      "max_brands",
      "storage_limit_bytes",
      "bandwidth_limit_bytes",
      "scheduled_posts_per_month",
      "social_connections",
      "can_use_video_generation",
      "can_use_premium_video",
      "can_use_advanced_analytics",
      "can_use_client_workspaces",
      "can_use_priority_support",
    ];
    const entitlementUpserts = entitlementKeys.map((entitlementKey) => {
      const raw = formData.get(entitlementKey);
      const normalized =
        typeof raw === "string"
          ? raw === "true"
            ? true
            : raw === "false"
              ? false
              : Number.isFinite(Number(raw))
                ? Number(raw)
                : raw
          : raw;
      return {
        plan_id: planId,
        entitlement_key: entitlementKey,
        value: normalized ?? null,
      };
    });
    const entitlementResult = await admin
      .from("plan_entitlements")
      .upsert(entitlementUpserts as never, { onConflict: "plan_id,entitlement_key" });
    if (entitlementResult.error) throw new Error(entitlementResult.error.message);
    await writeAdminAuditEvent({
      actorUserId: viewer.userId!,
      action: "pricing_plan_updated",
      resourceType: "pricing_plan",
      resourceId: planId,
      previousValue: current.data,
      newValue: payload,
      reason,
    });
    revalidatePath("/admin/plans");
    revalidatePath(`/admin/plans/${planId}`);
    revalidatePath("/pricing");
  });
}

export async function archivePlanAction(formData: FormData) {
  const returnPath = readString(formData, "returnPath") || "/admin/plans";
  await performAction(returnPath, async () => {
    const viewer = await requireAdminActionViewer();
    const admin = createAdminClient();
    const planId = readString(formData, "planId");
    const reason = requireSensitiveReason(readString(formData, "reason"));
    const { error } = await admin
      .from("pricing_plans")
      .update({ lifecycle_state: "archived", is_active: false, is_public: false } as never)
      .eq("id", planId);
    if (error) throw new Error(error.message);
    await writeAdminAuditEvent({
      actorUserId: viewer.userId!,
      action: "pricing_plan_archived",
      resourceType: "pricing_plan",
      resourceId: planId,
      previousValue: null,
      newValue: { lifecycle_state: "archived" },
      reason,
    });
    revalidatePath("/admin/plans");
    revalidatePath(`/admin/plans/${planId}`);
  });
}

export async function duplicatePlanAction(formData: FormData) {
  const returnPath = readString(formData, "returnPath") || "/admin/plans";
  await performAction(returnPath, async () => {
    const viewer = await requireAdminActionViewer();
    const admin = createAdminClient();
    const planId = readString(formData, "planId");
    const reason = requireSensitiveReason(readString(formData, "reason"));
    const plan = await admin
      .from("pricing_plans")
      .select("*")
      .eq("id", planId)
      .maybeSingle();
    const entitlements = await admin
      .from("plan_entitlements")
      .select("entitlement_key,value")
      .eq("plan_id", planId);
    if (plan.error || !plan.data) throw new Error(plan.error?.message || "PLAN_NOT_FOUND");
    if (entitlements.error) throw new Error(entitlements.error.message);
    const base = plan.data as Record<string, unknown>;
    const duplicate = await admin
      .from("pricing_plans")
      .insert({
        key: `${String(base.key)}-copy-${Date.now()}`.slice(0, 64),
        name: `${String(base.name)} Copy`,
        description: base.description,
        monthly_price_cents: base.monthly_price_cents,
        annual_price_cents: base.annual_price_cents,
        currency: base.currency,
        stripe_monthly_price_id: null,
        stripe_annual_price_id: null,
        is_public: false,
        is_active: false,
        lifecycle_state: "draft",
        sort_order: base.sort_order,
        metadata: { ...(base.metadata as Record<string, unknown> | null), duplicatedFrom: planId },
      } as never)
      .select("id")
      .single();
    if (duplicate.error) throw new Error(duplicate.error.message);
    const duplicatePlan = duplicate.data as { id: string };
    const duplicateId = String(duplicatePlan.id);
    if ((entitlements.data || []).length > 0) {
      const copyError = await admin.from("plan_entitlements").insert(
        (entitlements.data || []).map((row) => ({
          plan_id: duplicateId,
          entitlement_key: (row as Record<string, unknown>).entitlement_key,
          value: (row as Record<string, unknown>).value,
        })) as never,
      );
      if (copyError.error) throw new Error(copyError.error.message);
    }
    await writeAdminAuditEvent({
      actorUserId: viewer.userId!,
      action: "pricing_plan_duplicated",
      resourceType: "pricing_plan",
      resourceId: duplicateId,
      previousValue: { duplicated_from: planId },
      newValue: { duplicated_to: duplicateId },
      reason,
    });
    revalidatePath("/admin/plans");
  });
}

export async function publishPlanAction(formData: FormData) {
  const returnPath = readString(formData, "returnPath") || "/admin/plans";
  await performAction(returnPath, async () => {
    const viewer = await requireAdminActionViewer();
    const admin = createAdminClient();
    const planId = readString(formData, "planId");
    const publish = readString(formData, "mode") !== "unpublish";
    const reason = requireSensitiveReason(readString(formData, "reason"));
    const { error } = await admin
      .from("pricing_plans")
      .update({
        is_public: publish,
        lifecycle_state: publish ? "public" : "draft",
      } as never)
      .eq("id", planId);
    if (error) throw new Error(error.message);
    await writeAdminAuditEvent({
      actorUserId: viewer.userId!,
      action: publish ? "pricing_plan_published" : "pricing_plan_unpublished",
      resourceType: "pricing_plan",
      resourceId: planId,
      previousValue: null,
      newValue: { is_public: publish },
      reason,
    });
    revalidatePath("/admin/plans");
    revalidatePath(`/admin/plans/${planId}`);
    revalidatePath("/pricing");
  });
}

export async function reorderPlanAction(formData: FormData) {
  const returnPath = readString(formData, "returnPath") || "/admin/plans";
  await performAction(returnPath, async () => {
    const viewer = await requireAdminActionViewer();
    const admin = createAdminClient();
    const planId = readString(formData, "planId");
    const reason = requireSensitiveReason(readString(formData, "reason"));
    const sortOrder = Number(readString(formData, "sortOrder") || 0);
    const { error } = await admin
      .from("pricing_plans")
      .update({ sort_order: sortOrder } as never)
      .eq("id", planId);
    if (error) throw new Error(error.message);
    await writeAdminAuditEvent({
      actorUserId: viewer.userId!,
      action: "pricing_plan_reordered",
      resourceType: "pricing_plan",
      resourceId: planId,
      previousValue: null,
      newValue: { sort_order: sortOrder },
      reason,
    });
    revalidatePath("/admin/plans");
  });
}

export async function updateFeatureFlagAction(formData: FormData) {
  const returnPath = readString(formData, "returnPath") || "/admin/features";
  await performAction(returnPath, async () => {
    const viewer = await requireAdminActionViewer();
    const admin = createAdminClient();
    const featureFlagId = readString(formData, "featureFlagId");
    const reason = requireSensitiveReason(readString(formData, "reason"));
    const allowedPlanKeys = readString(formData, "allowedPlanKeys")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const allowedAccountTypes = readString(formData, "allowedAccountTypes")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const payload = {
      enabled: readBoolean(formData, "enabled"),
      rollout_percentage: Number(readString(formData, "rolloutPercentage") || 0),
      allowed_plan_keys: allowedPlanKeys,
      allowed_account_types: allowedAccountTypes,
    };
    const { error } = await admin.from("feature_flags").update(payload as never).eq("id", featureFlagId);
    if (error) throw new Error(error.message);
    await writeAdminAuditEvent({
      actorUserId: viewer.userId!,
      action: "feature_flag_updated",
      resourceType: "feature_flag",
      resourceId: featureFlagId,
      previousValue: null,
      newValue: payload,
      reason,
    });
    revalidatePath("/admin/features");
  });
}

export async function saveFeatureFlagOverrideAction(formData: FormData) {
  const returnPath = readString(formData, "returnPath") || "/admin/features";
  await performAction(returnPath, async () => {
    const viewer = await requireAdminActionViewer();
    const admin = createAdminClient();
    const featureFlagId = readString(formData, "featureFlagId");
    const accountId = readString(formData, "accountId");
    const enabled = readBoolean(formData, "enabled");
    const reason = requireSensitiveReason(readString(formData, "reason"));
    const { error } = await admin.from("account_feature_flag_overrides").upsert({
      account_id: accountId,
      feature_flag_id: featureFlagId,
      enabled,
      reason,
      created_by: viewer.userId!,
    } as never);
    if (error) throw new Error(error.message);
    await writeAdminAuditEvent({
      actorUserId: viewer.userId!,
      targetAccountId: accountId,
      action: "feature_flag_override_saved",
      resourceType: "feature_flag_override",
      resourceId: `${featureFlagId}:${accountId}`,
      previousValue: null,
      newValue: { enabled },
      reason,
    });
    revalidatePath("/admin/features");
  });
}

export async function removeFeatureFlagOverrideAction(formData: FormData) {
  const returnPath = readString(formData, "returnPath") || "/admin/features";
  await performAction(returnPath, async () => {
    const viewer = await requireAdminActionViewer();
    const admin = createAdminClient();
    const featureFlagId = readString(formData, "featureFlagId");
    const accountId = readString(formData, "accountId");
    const reason = requireSensitiveReason(readString(formData, "reason"));
    const { error } = await admin
      .from("account_feature_flag_overrides")
      .delete()
      .eq("feature_flag_id", featureFlagId)
      .eq("account_id", accountId);
    if (error) throw new Error(error.message);
    await writeAdminAuditEvent({
      actorUserId: viewer.userId!,
      targetAccountId: accountId,
      action: "feature_flag_override_removed",
      resourceType: "feature_flag_override",
      resourceId: `${featureFlagId}:${accountId}`,
      previousValue: { enabled: true },
      newValue: null,
      reason,
    });
    revalidatePath("/admin/features");
  });
}

export async function updateSystemSettingAction(formData: FormData) {
  const returnPath = readString(formData, "returnPath") || "/admin/settings";
  await performAction(returnPath, async () => {
    const viewer = await requireAdminActionViewer();
    const admin = createAdminClient();
    const key = readString(formData, "key") as never;
    const rawValue = readString(formData, "value");
    const reason = requireSensitiveReason(readString(formData, "reason"));
    const parsedValue = validateSystemSettingValue(key, rawValue);
    const current = await admin
      .from("system_settings")
      .select("value,is_secret")
      .eq("key", key)
      .maybeSingle();
    if (current.error) throw new Error(current.error.message);
    if (Boolean((current.data as { is_secret?: boolean } | null)?.is_secret)) {
      throw new Error("SETTING_SECRET_REJECTED:Secret settings cannot be edited here.");
    }
    const { error } = await admin
      .from("system_settings")
      .update({ value: parsedValue, updated_by: viewer.userId! } as never)
      .eq("key", key);
    if (error) throw new Error(error.message);
    await writeAdminAuditEvent({
      actorUserId: viewer.userId!,
      action: "system_setting_updated",
      resourceType: "system_setting",
      resourceId: key,
      previousValue: (current.data as { value?: unknown } | null)?.value ?? null,
      newValue: parsedValue,
      reason,
    });
    revalidatePath("/admin/settings");
  });
}