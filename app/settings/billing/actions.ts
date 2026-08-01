"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { createStripeCheckoutSession, createStripePortalSession } from "@/features/billing/stripe";

const ALLOWED_PLAN_KEYS = new Set(["starter", "professional", "business", "enterprise"]);

function stripePriceForPlan(planKey: string): string {
  const normalized = String(planKey || "").trim().toLowerCase();
  if (normalized === "starter") return String(process.env.STRIPE_PRICE_STARTER || "").trim();
  if (normalized === "professional") return String(process.env.STRIPE_PRICE_PROFESSIONAL || "").trim();
  if (normalized === "business") return String(process.env.STRIPE_PRICE_BUSINESS || "").trim();
  if (normalized === "enterprise") return String(process.env.STRIPE_PRICE_ENTERPRISE || "").trim();
  return "";
}

function safeOrigin(): string {
  const configured = String(process.env.NEXT_PUBLIC_APP_URL || "").trim();
  return configured || "http://localhost:3000";
}

export async function startCheckoutAction(formData: FormData) {
  const context = await requireWorkspaceContext();
  const planKey = String(formData.get("planKey") || "").trim().toLowerCase();

  if (!ALLOWED_PLAN_KEYS.has(planKey)) {
    throw new Error("BILLING_PLAN_INVALID:Select a supported plan.");
  }

  const priceId = stripePriceForPlan(planKey);
  if (!priceId) {
    throw new Error(`BILLING_PLAN_UNAVAILABLE:Missing Stripe price configuration for ${planKey}.`);
  }

  const origin = safeOrigin();
  const session = await createStripeCheckoutSession({
    workspaceId: context.workspaceId,
    email: context.email || `${context.workspaceId}@postmotive.local`,
    workspaceName: context.workspaceName,
    successUrl: `${origin}/settings/billing?checkout=success`,
    cancelUrl: `${origin}/settings/billing?checkout=cancelled`,
    lineItems: [{ priceId, quantity: 1 }],
  });

  redirect(session.url);
}

export async function openBillingPortalAction() {
  const context = await requireWorkspaceContext();
  const origin = safeOrigin();

  const portal = await createStripePortalSession({
    workspaceId: context.workspaceId,
    email: context.email || `${context.workspaceId}@postmotive.local`,
    workspaceName: context.workspaceName,
    returnUrl: `${origin}/settings/billing`,
  });

  redirect(portal.url);
}

export async function markBillingReviewCompleteAction() {
  const context = await requireWorkspaceContext();
  const { supabase } = context;

  const { error } = await supabase
    .from("workspace_onboarding_steps")
    .upsert(
      {
        workspace_id: context.workspaceId,
        step_key: "billing_review",
        completed: true,
        completed_at: new Date().toISOString(),
      } as never,
      { onConflict: "workspace_id,step_key" },
    );

  if (error) {
    throw new Error(`BILLING_REVIEW_SAVE_FAILED:${error.message}`);
  }

  revalidatePath("/settings/billing");
}
