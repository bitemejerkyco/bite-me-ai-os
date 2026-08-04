export const CANONICAL_STRIPE_PLAN_KEYS = [
  "starter",
  "professional",
  "business",
  "enterprise",
] as const;

export type CanonicalStripePlanKey = (typeof CANONICAL_STRIPE_PLAN_KEYS)[number];

export const SUPPORTED_STRIPE_WEBHOOK_EVENTS = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.resumed",
  "invoice.created",
  "invoice.paid",
  "invoice.payment_failed",
]);

export type WorkspaceBillingStatus =
  | "UNCONFIGURED"
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "SUSPENDED";

const PRICE_ENV_BY_PLAN: Record<CanonicalStripePlanKey, string> = {
  starter: "STRIPE_PRICE_STARTER",
  professional: "STRIPE_PRICE_PROFESSIONAL",
  business: "STRIPE_PRICE_BUSINESS",
  enterprise: "STRIPE_PRICE_ENTERPRISE",
};

export function buildStripePriceIdToPlanKeyMap(
  env: Record<string, string | undefined> = process.env,
): Map<string, CanonicalStripePlanKey> {
  const map = new Map<string, CanonicalStripePlanKey>();
  for (const planKey of CANONICAL_STRIPE_PLAN_KEYS) {
    const priceId = String(env[PRICE_ENV_BY_PLAN[planKey]] || "").trim();
    if (priceId) {
      map.set(priceId, planKey);
    }
  }
  return map;
}

export function mapStripeSubscriptionStatusToWorkspaceBillingStatus(
  status: string | null | undefined,
): WorkspaceBillingStatus | null {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "trialing") return "TRIALING";
  if (normalized === "active") return "ACTIVE";
  if (normalized === "past_due" || normalized === "unpaid") return "PAST_DUE";
  if (
    normalized === "canceled"
    || normalized === "incomplete_expired"
    || normalized === "paused"
  ) {
    return "CANCELED";
  }
  return null;
}

export function subscriptionStatusSupportsActiveWorkspace(
  status: string | null | undefined,
): boolean {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized === "active" || normalized === "trialing";
}

export function isSupportedStripeWebhookEvent(eventType: string): boolean {
  return SUPPORTED_STRIPE_WEBHOOK_EVENTS.has(eventType);
}

export function unixSecondsToIso(value: number | null | undefined): string | null {
  if (!Number.isFinite(value)) return null;
  return new Date(Number(value) * 1000).toISOString();
}
