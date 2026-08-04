import "server-only";

import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export type StripePlanKey =
  | "free_trial"
  | "starter"
  | "professional"
  | "business"
  | "enterprise";

type StripeEnv = {
  secretKey: string;
  publishableKey: string;
};

let stripeClient: Stripe | null = null;

function loadStripeEnv(): StripeEnv {
  const secretKey = String(process.env.STRIPE_SECRET_KEY || "").trim();
  const publishableKey = String(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "").trim();

  if (!secretKey) {
    throw new Error("STRIPE_CONFIG_MISSING:STRIPE_SECRET_KEY is required.");
  }

  if (!publishableKey) {
    throw new Error("STRIPE_CONFIG_MISSING:NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required.");
  }

  return { secretKey, publishableKey };
}

export function getStripeClient(): Stripe {
  if (!stripeClient) {
    const env = loadStripeEnv();
    stripeClient = new Stripe(env.secretKey);
  }
  return stripeClient;
}

export function getStripeWebhookSecret(): string {
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_NOT_CONFIGURED:STRIPE_WEBHOOK_SECRET is required.");
  }
  return secret;
}

export function constructStripeWebhookEvent(
  rawBody: string,
  signature: string,
  webhookSecret: string,
): Stripe.Event {
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

export async function resolveOrCreateStripeCustomer(input: {
  workspaceId: string;
  email: string;
  workspaceName: string;
}): Promise<{ customerId: string }> {
  const admin = createAdminClient();

  const existing = await admin
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  const existingRow = existing.data as { stripe_customer_id?: string | null } | null;
  if (existingRow?.stripe_customer_id) {
    return { customerId: existingRow.stripe_customer_id };
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: input.email,
    name: input.workspaceName,
    metadata: {
      workspaceId: input.workspaceId,
    },
  });

  const { error } = await admin.from("stripe_customers").upsert(
    {
      workspace_id: input.workspaceId,
      stripe_customer_id: customer.id,
      email: input.email,
      livemode: Boolean(customer.livemode),
      metadata: customer.metadata,
    } as never,
    { onConflict: "workspace_id" },
  );

  if (error) {
    throw new Error(`STRIPE_CUSTOMER_SAVE_FAILED:${error.message}`);
  }

  return { customerId: customer.id };
}

export async function createStripeCheckoutSession(input: {
  workspaceId: string;
  email: string;
  workspaceName: string;
  successUrl: string;
  cancelUrl: string;
  lineItems: Array<{ priceId: string; quantity: number }>;
}): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripeClient();
  const { customerId } = await resolveOrCreateStripeCustomer({
    workspaceId: input.workspaceId,
    email: input.email,
    workspaceName: input.workspaceName,
  });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    line_items: input.lineItems.map((item) => ({
      price: item.priceId,
      quantity: item.quantity,
    })),
    metadata: {
      workspaceId: input.workspaceId,
    },
    allow_promotion_codes: true,
  });

  if (!session.url) {
    throw new Error("STRIPE_CHECKOUT_FAILED:Stripe did not return a checkout URL.");
  }

  return {
    url: session.url,
    sessionId: session.id,
  };
}

export async function createStripePortalSession(input: {
  workspaceId: string;
  email: string;
  workspaceName: string;
  returnUrl: string;
}): Promise<{ url: string }> {
  const stripe = getStripeClient();
  const { customerId } = await resolveOrCreateStripeCustomer({
    workspaceId: input.workspaceId,
    email: input.email,
    workspaceName: input.workspaceName,
  });

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: input.returnUrl,
  });

  return { url: session.url };
}
