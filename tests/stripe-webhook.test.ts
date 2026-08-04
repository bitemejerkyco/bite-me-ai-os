import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

vi.mock("server-only", () => ({}));

type TableWrite = {
  table: string;
  operation: "upsert" | "update" | "insert";
  payload: Record<string, unknown>;
  filters?: Record<string, unknown>;
};

function baseSubscription(overrides: Partial<Stripe.Subscription> = {}): Stripe.Subscription {
  return {
    id: "sub_test_123",
    object: "subscription",
    customer: "cus_test_123",
    status: "active",
    livemode: false,
    metadata: { workspaceId: "workspace-1" },
    items: {
      object: "list",
      data: [{
        id: "si_1",
        current_period_start: 1_700_000_000,
        current_period_end: 1_702_592_000,
        price: { id: "price_professional", object: "price" } as Stripe.Price,
      }],
      has_more: false,
      url: "/v1/subscription_items",
    },
    current_period_start: 1_700_000_000,
    current_period_end: 1_702_592_000,
    cancel_at_period_end: false,
    canceled_at: null,
    ...overrides,
  } as Stripe.Subscription;
}

function baseInvoice(overrides: Partial<Stripe.Invoice> = {}): Stripe.Invoice {
  return {
    id: "in_test_123",
    object: "invoice",
    customer: "cus_test_123",
    subscription: "sub_test_123",
    status: "paid",
    livemode: false,
    amount_due: 4900,
    amount_paid: 4900,
    currency: "usd",
    hosted_invoice_url: "https://invoice.stripe.com/test",
    invoice_pdf: "https://pay.stripe.com/test.pdf",
    due_date: 1_702_000_000,
    status_transitions: { paid_at: 1_701_900_000 },
    metadata: { workspaceId: "workspace-1" },
    ...overrides,
  } as Stripe.Invoice;
}

function createAdminStub(options?: {
  existingWebhookEvent?: { id: string; status: string } | null;
  insertWebhookEventError?: string | null;
  workspace?: {
    id: string;
    billing_exempt: boolean;
    billing_status: string;
    pricing_plan_id: string | null;
  };
  stripeCustomer?: { workspace_id: string; stripe_customer_id: string } | null;
  stripeSubscription?: { workspace_id: string; stripe_subscription_id: string; status: string } | null;
  pricingPlan?: { id: string; key: string; stripe_monthly_price_id: string | null };
  upsertErrorMessage?: string | null;
  upsertErrorTable?: string | null;
}) {
  const writes: TableWrite[] = [];
  const workspace = options?.workspace ?? {
    id: "workspace-1",
    billing_exempt: false,
    billing_status: "ACTIVE",
    pricing_plan_id: null,
  };
  const pricingPlan = options?.pricingPlan ?? {
    id: "plan-professional",
    key: "professional",
    stripe_monthly_price_id: "price_professional",
  };

  class Builder {
    private op: "select" | "insert" | "update" | "upsert" | null = null;
    private payload: Record<string, unknown> | null = null;
    private filters = new Map<string, unknown>();

    constructor(private readonly table: string) {}

    select(): this {
      if (!this.op) this.op = "select";
      return this;
    }

    insert(payload: Record<string, unknown>): this {
      this.op = "insert";
      this.payload = payload;
      return this;
    }

    update(payload: Record<string, unknown>) {
      this.op = "update";
      this.payload = payload;
      writes.push({
        table: this.table,
        operation: "update",
        payload,
        filters: Object.fromEntries(this.filters),
      });
      return this;
    }

    upsert(payload: Record<string, unknown>) {
      this.op = "upsert";
      this.payload = payload;
      writes.push({
        table: this.table,
        operation: "upsert",
        payload,
      });
      const shouldFail = Boolean(
        options?.upsertErrorMessage
        && (!options.upsertErrorTable || options.upsertErrorTable === this.table),
      );
      return Promise.resolve({
        error: shouldFail ? { message: options?.upsertErrorMessage } : null,
      });
    }

    eq(key: string, value: unknown) {
      this.filters.set(key, value);
      if (this.op === "update") {
        return Promise.resolve({ error: null });
      }
      return this;
    }

    order(): this {
      return this;
    }

    limit(): this {
      return this;
    }

    maybeSingle = async () => {
      if (this.table === "integration_webhook_events" && this.op === "select") {
        if (options?.existingWebhookEvent) {
          return { data: options.existingWebhookEvent, error: null };
        }
        return { data: null, error: null };
      }

      if (this.table === "workspaces" && this.filters.get("id") === workspace.id) {
        return { data: workspace, error: null };
      }

      if (this.table === "stripe_customers") {
        const customerId = this.filters.get("stripe_customer_id");
        if (options?.stripeCustomer && customerId === options.stripeCustomer.stripe_customer_id) {
          return { data: options.stripeCustomer, error: null };
        }
      }

      if (this.table === "stripe_subscriptions") {
        const subscriptionId = this.filters.get("stripe_subscription_id");
        if (options?.stripeSubscription && subscriptionId === options.stripeSubscription.stripe_subscription_id) {
          return { data: options.stripeSubscription, error: null };
        }
      }

      if (this.table === "pricing_plans") {
        const priceId = this.filters.get("stripe_monthly_price_id");
        if (priceId === pricingPlan.stripe_monthly_price_id) {
          return { data: pricingPlan, error: null };
        }
        const planKey = this.filters.get("key");
        if (planKey === pricingPlan.key) {
          return { data: pricingPlan, error: null };
        }
      }

      return { data: null, error: null };
    };

    single = async () => {
      if (this.table === "integration_webhook_events" && this.op === "insert") {
        if (options?.insertWebhookEventError) {
          return { data: null, error: { message: options.insertWebhookEventError } };
        }
        writes.push({
          table: this.table,
          operation: "insert",
          payload: this.payload ?? {},
        });
        return { data: { id: "webhook-event-1" }, error: null };
      }
      return this.maybeSingle();
    };
  }

  return {
    from(table: string) {
      return new Builder(table);
    },
    writes,
  };
}

const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const originalPriceProfessional = process.env.STRIPE_PRICE_PROFESSIONAL;

function restoreEnv(): void {
  if (originalWebhookSecret === undefined) {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  } else {
    process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
  }
  if (originalPriceProfessional === undefined) {
    delete process.env.STRIPE_PRICE_PROFESSIONAL;
  } else {
    process.env.STRIPE_PRICE_PROFESSIONAL = originalPriceProfessional;
  }
}

function makeEvent(type: string, object: unknown): Stripe.Event {
  return {
    id: "evt_test_123",
    object: "event",
    type,
    created: 1_700_000_000,
    livemode: false,
    data: { object },
  } as Stripe.Event;
}

describe("stripe webhook handler", () => {
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
    process.env.STRIPE_PRICE_PROFESSIONAL = "price_professional";
  });

  afterEach(() => {
    restoreEnv();
    vi.resetModules();
  });

  it("returns 400 when webhook signature verification fails", async () => {
    const { handleStripeWebhookRequest } = await import("@/features/billing/stripe-webhook");
    const admin = createAdminStub();

    const result = await handleStripeWebhookRequest({
      rawBody: "{}",
      signature: "bad-signature",
      admin: admin as never,
      constructEvent: () => {
        throw new Error("Invalid signature");
      },
    });

    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/signature verification failed/i);
    expect(admin.writes).toHaveLength(0);
  });

  it("returns 500 when STRIPE_WEBHOOK_SECRET is missing", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { handleStripeWebhookRequest } = await import("@/features/billing/stripe-webhook");
    const admin = createAdminStub();

    const result = await handleStripeWebhookRequest({
      rawBody: "{}",
      signature: "sig_test",
      admin: admin as never,
      constructEvent: () => makeEvent("invoice.paid", baseInvoice()),
    });

    expect(result.status).toBe(500);
    expect(result.body.error).toMatch(/webhook secret is missing/i);
  });

  it("returns 200 for duplicate events without reprocessing", async () => {
    const { handleStripeWebhookRequest } = await import("@/features/billing/stripe-webhook");
    const admin = createAdminStub({
      existingWebhookEvent: { id: "existing-event", status: "PROCESSED" },
    });

    const result = await handleStripeWebhookRequest({
      rawBody: "{}",
      signature: "sig_test",
      admin: admin as never,
      constructEvent: () => makeEvent("customer.subscription.updated", baseSubscription()),
    });

    expect(result.status).toBe(200);
    expect(result.body.duplicate).toBe(true);
    expect(admin.writes).toHaveLength(0);
  });

  it("syncs subscription updates with status, plan, period, and workspace", async () => {
    const { processStripeWebhookEvent } = await import("@/features/billing/stripe-webhook");
    const admin = createAdminStub();

    const result = await processStripeWebhookEvent(
      admin as never,
      makeEvent("customer.subscription.updated", baseSubscription({ status: "trialing" })),
    );

    expect(result.outcome).toBe("processed");
    expect(admin.writes.some((write) => write.table === "stripe_subscriptions")).toBe(true);
    expect(admin.writes.some((write) => write.table === "stripe_customers")).toBe(true);
    expect(admin.writes.some((write) =>
      write.table === "workspaces"
      && write.payload.billing_status === "TRIALING"
      && write.payload.pricing_plan_id === "plan-professional",
    )).toBe(true);
  });

  it("marks canceled subscriptions but skips billing downgrade for billing-exempt workspaces", async () => {
    const { processStripeWebhookEvent } = await import("@/features/billing/stripe-webhook");
    const admin = createAdminStub({
      workspace: {
        id: "workspace-1",
        billing_exempt: true,
        billing_status: "ACTIVE",
        pricing_plan_id: "plan-professional",
      },
    });

    const result = await processStripeWebhookEvent(
      admin as never,
      makeEvent("customer.subscription.deleted", baseSubscription({ status: "canceled" })),
    );

    expect(result.outcome).toBe("processed");
    expect(admin.writes.some((write) =>
      write.table === "stripe_subscriptions"
      && write.payload.status === "canceled",
    )).toBe(true);
    expect(admin.writes.some((write) =>
      write.table === "workspaces"
      && write.payload.billing_status === "CANCELED",
    )).toBe(false);
  });

  it("syncs paid invoices and sets workspace active when subscription supports it", async () => {
    const { processStripeWebhookEvent } = await import("@/features/billing/stripe-webhook");
    const admin = createAdminStub({
      stripeSubscription: {
        workspace_id: "workspace-1",
        stripe_subscription_id: "sub_test_123",
        status: "active",
      },
    });

    const result = await processStripeWebhookEvent(
      admin as never,
      makeEvent("invoice.paid", baseInvoice()),
    );

    expect(result.outcome).toBe("processed");
    expect(admin.writes.some((write) => write.table === "billing_invoices")).toBe(true);
    expect(admin.writes.some((write) =>
      write.table === "workspaces"
      && write.payload.billing_status === "ACTIVE",
    )).toBe(true);
  });

  it("syncs failed invoice payments and sets workspace past due when not billing-exempt", async () => {
    const { processStripeWebhookEvent } = await import("@/features/billing/stripe-webhook");
    const admin = createAdminStub();

    const result = await processStripeWebhookEvent(
      admin as never,
      makeEvent("invoice.payment_failed", baseInvoice({ status: "open", amount_paid: 0 })),
    );

    expect(result.outcome).toBe("processed");
    expect(admin.writes.some((write) => write.table === "billing_invoices")).toBe(true);
    expect(admin.writes.some((write) =>
      write.table === "workspaces"
      && write.payload.billing_status === "PAST_DUE",
    )).toBe(true);
  });

  it("returns 200 ignored for unsupported events", async () => {
    const { handleStripeWebhookRequest } = await import("@/features/billing/stripe-webhook");
    const admin = createAdminStub();

    const result = await handleStripeWebhookRequest({
      rawBody: "{}",
      signature: "sig_test",
      admin: admin as never,
      constructEvent: () => makeEvent("payment_intent.succeeded", { id: "pi_123" }),
    });

    expect(result.status).toBe(200);
    expect(result.body.ignored).toBe(true);
    expect(admin.writes.some((write) => write.table === "stripe_subscriptions")).toBe(false);
    expect(admin.writes.some((write) => write.table === "billing_invoices")).toBe(false);
  });

  it("returns 200 for unresolved workspace without tenant billing writes", async () => {
    const { processStripeWebhookEvent } = await import("@/features/billing/stripe-webhook");
    const admin = createAdminStub({
      stripeCustomer: null,
    });

    const result = await processStripeWebhookEvent(
      admin as never,
      makeEvent(
        "customer.subscription.updated",
        baseSubscription({
          metadata: {},
          customer: "cus_unknown",
        }),
      ),
    );

    expect(result.outcome).toBe("unresolved_workspace");
    expect(admin.writes.some((write) => write.table === "stripe_subscriptions")).toBe(false);
    expect(admin.writes.some((write) => write.table === "stripe_customers")).toBe(false);
    expect(admin.writes.some((write) => write.table === "billing_invoices")).toBe(false);
  });

  it("returns 500 on processing failure so Stripe can retry", async () => {
    const { handleStripeWebhookRequest } = await import("@/features/billing/stripe-webhook");
    const admin = createAdminStub({
      upsertErrorMessage: "Simulated database failure",
      upsertErrorTable: "stripe_subscriptions",
    });

    const result = await handleStripeWebhookRequest({
      rawBody: "{}",
      signature: "sig_test",
      admin: admin as never,
      constructEvent: () => makeEvent("customer.subscription.updated", baseSubscription()),
    });

    expect(result.status).toBe(500);
    expect(result.body.error).toMatch(/STRIPE_SUBSCRIPTION_UPSERT_FAILED/);
    expect(admin.writes.some((write) =>
      write.table === "integration_webhook_events"
      && write.operation === "update"
      && write.payload.status === "FAILED",
    )).toBe(true);
  });
});

describe("stripe webhook helpers", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("maps env price IDs to canonical plan keys", async () => {
    process.env.STRIPE_PRICE_PROFESSIONAL = "price_professional";
    const { resolvePlanKeyFromStripePriceId } = await import("@/features/billing/stripe-webhook");
    const admin = createAdminStub();

    await expect(resolvePlanKeyFromStripePriceId(admin as never, "price_professional")).resolves.toBe(
      "professional",
    );
  });

  it("skips billing status downgrades for billing-exempt workspaces", async () => {
    const { shouldSkipBillingStatusDowngrade } = await import("@/features/billing/stripe-webhook");

    expect(shouldSkipBillingStatusDowngrade(true, "PAST_DUE")).toBe(true);
    expect(shouldSkipBillingStatusDowngrade(true, "CANCELED")).toBe(true);
    expect(shouldSkipBillingStatusDowngrade(true, "ACTIVE")).toBe(false);
    expect(shouldSkipBillingStatusDowngrade(false, "PAST_DUE")).toBe(false);
  });
});
