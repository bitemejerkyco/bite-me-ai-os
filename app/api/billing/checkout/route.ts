import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { createStripeCheckoutSession } from "@/features/billing/stripe";

const ALLOWED_PLAN_KEYS = new Set(["starter", "professional", "business", "enterprise"]);

const STRIPE_PRICE_BY_PLAN: Record<string, string> = {
  starter: String(process.env.STRIPE_PRICE_STARTER || "").trim(),
  professional: String(process.env.STRIPE_PRICE_PROFESSIONAL || "").trim(),
  business: String(process.env.STRIPE_PRICE_BUSINESS || "").trim(),
  enterprise: String(process.env.STRIPE_PRICE_ENTERPRISE || "").trim(),
};

export async function POST(request: NextRequest) {
  try {
    const context = await requireWorkspaceContext();
    const body = (await request.json()) as { planKey?: string };
    const planKey = String(body.planKey || "").trim().toLowerCase();
    if (!ALLOWED_PLAN_KEYS.has(planKey)) {
      throw new Error("BILLING_PLAN_INVALID:Choose a supported plan.");
    }

    const priceId = STRIPE_PRICE_BY_PLAN[planKey];
    if (!priceId) {
      throw new Error(`BILLING_PLAN_UNAVAILABLE:Configure Stripe price for ${planKey}.`);
    }

    const origin = new URL(request.url).origin;
    const session = await createStripeCheckoutSession({
      workspaceId: context.workspaceId,
      email: context.email || `${context.workspaceId}@postmotive.local`,
      workspaceName: context.workspaceName,
      successUrl: `${origin}/settings/billing?checkout=success`,
      cancelUrl: `${origin}/settings/billing?checkout=cancelled`,
      lineItems: [{ priceId, quantity: 1 }],
    });

    return NextResponse.json({ ok: true, data: session });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
