import "server-only";

import { createHash } from "node:crypto";
import type Stripe from "stripe";
import {
  buildStripePriceIdToPlanKeyMap,
  isSupportedStripeWebhookEvent,
  mapStripeSubscriptionStatusToWorkspaceBillingStatus,
  subscriptionStatusSupportsActiveWorkspace,
  type CanonicalStripePlanKey,
  type WorkspaceBillingStatus,
  unixSecondsToIso,
} from "@/features/billing/stripe-webhook-config";
import {
  constructStripeWebhookEvent,
  getStripeClient,
  getStripeWebhookSecret,
} from "@/features/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type StripeWebhookProcessResult =
  | { outcome: "ignored"; eventType: string }
  | { outcome: "unresolved_workspace"; eventType: string; customerId: string | null }
  | { outcome: "processed"; eventType: string; workspaceId: string | null };

type WorkspaceBillingFlags = {
  billing_exempt: boolean;
  billing_status: string | null;
  pricing_plan_id: string | null;
};

type PricingPlanRow = {
  id: string;
  key: string;
  stripe_monthly_price_id: string | null;
};

function safeStripeId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  return null;
}

function readInvoiceSubscriptionRef(invoice: Stripe.Invoice): unknown {
  const legacySubscription = (invoice as Stripe.Invoice & { subscription?: unknown }).subscription;
  if (legacySubscription) return legacySubscription;
  return invoice.parent?.subscription_details?.subscription ?? null;
}

function readWorkspaceIdFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const workspaceId = (metadata as Record<string, unknown>).workspaceId;
  return typeof workspaceId === "string" && workspaceId.trim() ? workspaceId.trim() : null;
}

function minimalEventMetadata(input: {
  eventType: string;
  workspaceId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  invoiceId?: string | null;
  processingStatus: string;
}): Record<string, string | null> {
  return {
    eventType: input.eventType,
    workspaceId: input.workspaceId ?? null,
    customerId: input.customerId ?? null,
    subscriptionId: input.subscriptionId ?? null,
    invoiceId: input.invoiceId ?? null,
    processingStatus: input.processingStatus,
  };
}

function payloadHash(event: Stripe.Event): string {
  return createHash("sha256")
    .update(`${event.id}:${event.type}:${event.created}`, "utf8")
    .digest("hex");
}

export async function resolvePlanKeyFromStripePriceId(
  admin: AdminClient,
  priceId: string | null | undefined,
  priceMap: Map<string, CanonicalStripePlanKey> = buildStripePriceIdToPlanKeyMap(),
): Promise<CanonicalStripePlanKey | null> {
  const normalized = String(priceId || "").trim();
  if (!normalized) return null;

  const fromEnv = priceMap.get(normalized);
  if (fromEnv) return fromEnv;

  const { data, error } = await admin
    .from("pricing_plans")
    .select("key,stripe_monthly_price_id")
    .eq("stripe_monthly_price_id", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(`STRIPE_PLAN_LOOKUP_FAILED:${error.message}`);
  }

  const row = data as PricingPlanRow | null;
  const planKey = String(row?.key || "").trim();
  if (
    planKey === "starter"
    || planKey === "professional"
    || planKey === "business"
    || planKey === "enterprise"
  ) {
    return planKey;
  }

  return null;
}

async function lookupPricingPlanIdByKey(
  admin: AdminClient,
  planKey: CanonicalStripePlanKey | null,
): Promise<string | null> {
  if (!planKey) return null;
  const { data, error } = await admin
    .from("pricing_plans")
    .select("id,key")
    .eq("key", planKey)
    .maybeSingle();
  if (error) {
    throw new Error(`STRIPE_PLAN_LOOKUP_FAILED:${error.message}`);
  }
  const row = data as { id?: string | null } | null;
  return row?.id ? String(row.id) : null;
}

export async function resolveWorkspaceIdForStripeCustomer(
  admin: AdminClient,
  customerId: string | null | undefined,
): Promise<string | null> {
  const normalized = String(customerId || "").trim();
  if (!normalized) return null;

  const { data, error } = await admin
    .from("stripe_customers")
    .select("workspace_id")
    .eq("stripe_customer_id", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(`STRIPE_CUSTOMER_LOOKUP_FAILED:${error.message}`);
  }

  const workspaceId = (data as { workspace_id?: string | null } | null)?.workspace_id;
  return workspaceId ? String(workspaceId) : null;
}

export async function resolveWorkspaceId(
  admin: AdminClient,
  input: {
    metadata?: unknown;
    customerId?: string | null;
    subscriptionId?: string | null;
  },
): Promise<string | null> {
  const fromMetadata = readWorkspaceIdFromMetadata(input.metadata);
  if (fromMetadata) return fromMetadata;

  const fromCustomer = await resolveWorkspaceIdForStripeCustomer(admin, input.customerId);
  if (fromCustomer) return fromCustomer;

  const subscriptionId = String(input.subscriptionId || "").trim();
  if (subscriptionId) {
    const { data, error } = await admin
      .from("stripe_subscriptions")
      .select("workspace_id")
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();
    if (error) {
      throw new Error(`STRIPE_SUBSCRIPTION_LOOKUP_FAILED:${error.message}`);
    }
    const workspaceId = (data as { workspace_id?: string | null } | null)?.workspace_id;
    if (workspaceId) return String(workspaceId);
  }

  return null;
}

async function loadWorkspaceBillingFlags(
  admin: AdminClient,
  workspaceId: string,
): Promise<WorkspaceBillingFlags> {
  const { data, error } = await admin
    .from("workspaces")
    .select("billing_exempt,billing_status,pricing_plan_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error) {
    throw new Error(`WORKSPACE_LOOKUP_FAILED:${error.message}`);
  }

  const row = data as WorkspaceBillingFlags | null;
  if (!row) {
    throw new Error("WORKSPACE_NOT_FOUND:Workspace was not found.");
  }

  return {
    billing_exempt: Boolean(row.billing_exempt),
    billing_status: row.billing_status ?? null,
    pricing_plan_id: row.pricing_plan_id ?? null,
  };
}

export function shouldSkipBillingStatusDowngrade(
  billingExempt: boolean,
  nextStatus: WorkspaceBillingStatus | null,
): boolean {
  if (!billingExempt || !nextStatus) return false;
  return nextStatus === "PAST_DUE" || nextStatus === "CANCELED";
}

function readStripeCustomerEmail(customer: Stripe.Subscription["customer"]): string | null {
  if (typeof customer !== "object" || !customer || "deleted" in customer) return null;
  return customer.email ?? null;
}

export async function upsertStripeCustomerRecord(
  admin: AdminClient,
  input: {
    workspaceId: string;
    stripeCustomerId: string;
    email?: string | null;
    livemode?: boolean;
    eventType: string;
  },
): Promise<void> {
  const { error } = await admin.from("stripe_customers").upsert(
    {
      workspace_id: input.workspaceId,
      stripe_customer_id: input.stripeCustomerId,
      email: input.email ?? null,
      livemode: Boolean(input.livemode),
      metadata: {
        source: "stripe_webhook",
        last_event_type: input.eventType,
      },
    } as never,
    { onConflict: "workspace_id" },
  );

  if (error) {
    throw new Error(`STRIPE_CUSTOMER_UPSERT_FAILED:${error.message}`);
  }
}

function readSubscriptionBillingPeriod(subscription: Stripe.Subscription): {
  currentPeriodStart: number | null;
  currentPeriodEnd: number | null;
} {
  const firstItem = subscription.items?.data?.[0];
  return {
    currentPeriodStart: firstItem?.current_period_start ?? null,
    currentPeriodEnd: firstItem?.current_period_end ?? null,
  };
}

export async function upsertStripeSubscriptionRecord(
  admin: AdminClient,
  input: {
    workspaceId: string;
    stripeCustomerId: string;
    subscription: Stripe.Subscription;
    planKey: CanonicalStripePlanKey | null;
    eventType: string;
  },
): Promise<void> {
  const priceId =
    input.subscription.items.data[0]?.price?.id
    ?? (typeof input.subscription.items.data[0]?.plan?.id === "string"
      ? input.subscription.items.data[0]?.plan?.id
      : null);

  const billingPeriod = readSubscriptionBillingPeriod(input.subscription);

  const { error } = await admin.from("stripe_subscriptions").upsert(
    {
      workspace_id: input.workspaceId,
      stripe_customer_id: input.stripeCustomerId,
      stripe_subscription_id: input.subscription.id,
      stripe_price_id: priceId,
      plan_key: input.planKey,
      status: input.subscription.status,
      current_period_start: unixSecondsToIso(billingPeriod.currentPeriodStart),
      current_period_end: unixSecondsToIso(billingPeriod.currentPeriodEnd),
      cancel_at_period_end: Boolean(input.subscription.cancel_at_period_end),
      canceled_at: unixSecondsToIso(input.subscription.canceled_at),
      metadata: {
        source: "stripe_webhook",
        last_event_type: input.eventType,
      },
    } as never,
    { onConflict: "stripe_subscription_id" },
  );

  if (error) {
    throw new Error(`STRIPE_SUBSCRIPTION_UPSERT_FAILED:${error.message}`);
  }
}

export async function upsertBillingInvoiceRecord(
  admin: AdminClient,
  input: {
    workspaceId: string;
    invoice: Stripe.Invoice;
    eventType: string;
  },
): Promise<void> {
  const { error } = await admin.from("billing_invoices").upsert(
    {
      workspace_id: input.workspaceId,
      stripe_invoice_id: input.invoice.id,
      stripe_subscription_id: safeStripeId(readInvoiceSubscriptionRef(input.invoice)),
      amount_due_cents: Number(input.invoice.amount_due || 0),
      amount_paid_cents: Number(input.invoice.amount_paid || 0),
      currency: String(input.invoice.currency || "usd").toUpperCase(),
      status: String(input.invoice.status || "draft"),
      hosted_invoice_url: input.invoice.hosted_invoice_url ?? null,
      invoice_pdf_url: input.invoice.invoice_pdf ?? null,
      due_at: unixSecondsToIso(input.invoice.due_date),
      paid_at: unixSecondsToIso(
        input.invoice.status_transitions?.paid_at ?? null,
      ),
      metadata: {
        source: "stripe_webhook",
        last_event_type: input.eventType,
      },
    } as never,
    { onConflict: "stripe_invoice_id" },
  );

  if (error) {
    throw new Error(`STRIPE_INVOICE_UPSERT_FAILED:${error.message}`);
  }
}

export async function updateWorkspaceBillingState(
  admin: AdminClient,
  input: {
    workspaceId: string;
    planKey?: CanonicalStripePlanKey | null;
    billingStatus?: WorkspaceBillingStatus | null;
    billingExempt?: boolean;
  },
): Promise<void> {
  const flags = input.billingExempt === undefined
    ? await loadWorkspaceBillingFlags(admin, input.workspaceId)
    : {
        billing_exempt: input.billingExempt,
        billing_status: null,
        pricing_plan_id: null,
      };

  const patch: Record<string, unknown> = {};

  if (input.planKey) {
    const pricingPlanId = await lookupPricingPlanIdByKey(admin, input.planKey);
    if (pricingPlanId) {
      patch.pricing_plan_id = pricingPlanId;
    }
  }

  if (input.billingStatus) {
    if (!shouldSkipBillingStatusDowngrade(flags.billing_exempt, input.billingStatus)) {
      patch.billing_status = input.billingStatus;
    }
  }

  if (Object.keys(patch).length === 0) return;

  const { error } = await admin
    .from("workspaces")
    .update(patch as never)
    .eq("id", input.workspaceId);

  if (error) {
    throw new Error(`WORKSPACE_BILLING_UPDATE_FAILED:${error.message}`);
  }
}

async function syncSubscriptionFromStripeObject(
  admin: AdminClient,
  input: {
    subscription: Stripe.Subscription;
    eventType: string;
    workspaceIdHint?: string | null;
  },
): Promise<StripeWebhookProcessResult> {
  const customerId = safeStripeId(input.subscription.customer);
  const workspaceId = await resolveWorkspaceId(admin, {
    metadata: input.subscription.metadata,
    customerId,
    subscriptionId: input.subscription.id,
  }) ?? input.workspaceIdHint ?? null;

  if (!workspaceId || !customerId) {
    return {
      outcome: "unresolved_workspace",
      eventType: input.eventType,
      customerId,
    };
  }

  const priceId = input.subscription.items.data[0]?.price?.id ?? null;
  const planKey = await resolvePlanKeyFromStripePriceId(admin, priceId);
  const flags = await loadWorkspaceBillingFlags(admin, workspaceId);

  await upsertStripeCustomerRecord(admin, {
    workspaceId,
    stripeCustomerId: customerId,
    email: readStripeCustomerEmail(input.subscription.customer),
    livemode: input.subscription.livemode,
    eventType: input.eventType,
  });

  await upsertStripeSubscriptionRecord(admin, {
    workspaceId,
    stripeCustomerId: customerId,
    subscription: input.subscription,
    planKey,
    eventType: input.eventType,
  });

  const billingStatus = mapStripeSubscriptionStatusToWorkspaceBillingStatus(
    input.subscription.status,
  );

  await updateWorkspaceBillingState(admin, {
    workspaceId,
    planKey,
    billingStatus,
    billingExempt: flags.billing_exempt,
  });

  return {
    outcome: "processed",
    eventType: input.eventType,
    workspaceId,
  };
}

async function syncInvoiceFromStripeObject(
  admin: AdminClient,
  input: {
    invoice: Stripe.Invoice;
    eventType: string;
    forceBillingStatus?: WorkspaceBillingStatus | null;
  },
): Promise<StripeWebhookProcessResult> {
  const customerId = safeStripeId(input.invoice.customer);
  const subscriptionRef = readInvoiceSubscriptionRef(input.invoice);
  const subscriptionId = safeStripeId(subscriptionRef);
  const workspaceId = await resolveWorkspaceId(admin, {
    metadata: input.invoice.metadata,
    customerId,
    subscriptionId,
  });

  if (!workspaceId || !customerId) {
    return {
      outcome: "unresolved_workspace",
      eventType: input.eventType,
      customerId,
    };
  }

  const flags = await loadWorkspaceBillingFlags(admin, workspaceId);

  await upsertStripeCustomerRecord(admin, {
    workspaceId,
    stripeCustomerId: customerId,
    email: typeof input.invoice.customer_email === "string"
      ? input.invoice.customer_email
      : null,
    livemode: input.invoice.livemode,
    eventType: input.eventType,
  });

  await upsertBillingInvoiceRecord(admin, {
    workspaceId,
    invoice: input.invoice,
    eventType: input.eventType,
  });

  if (input.forceBillingStatus) {
    await updateWorkspaceBillingState(admin, {
      workspaceId,
      billingStatus: input.forceBillingStatus,
      billingExempt: flags.billing_exempt,
    });
  } else if (input.eventType === "invoice.paid") {
    let subscriptionStatus: string | null = null;
    if (typeof subscriptionRef === "object" && subscriptionRef) {
      subscriptionStatus = (subscriptionRef as Stripe.Subscription).status ?? null;
    } else if (subscriptionId) {
      const { data } = await admin
        .from("stripe_subscriptions")
        .select("status")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();
      subscriptionStatus = (data as { status?: string | null } | null)?.status ?? null;
    }

    if (subscriptionStatusSupportsActiveWorkspace(subscriptionStatus)) {
      await updateWorkspaceBillingState(admin, {
        workspaceId,
        billingStatus: "ACTIVE",
        billingExempt: flags.billing_exempt,
      });
    }
  }

  return {
    outcome: "processed",
    eventType: input.eventType,
    workspaceId,
  };
}

export async function processStripeWebhookEvent(
  admin: AdminClient,
  event: Stripe.Event,
): Promise<StripeWebhookProcessResult> {
  if (!isSupportedStripeWebhookEvent(event.type)) {
    return { outcome: "ignored", eventType: event.type };
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = safeStripeId(session.customer);
      const subscriptionId = safeStripeId(session.subscription);
      const workspaceId = await resolveWorkspaceId(admin, {
        metadata: session.metadata,
        customerId,
        subscriptionId,
      });

      if (!workspaceId || !customerId) {
        return {
          outcome: "unresolved_workspace",
          eventType: event.type,
          customerId,
        };
      }

      await upsertStripeCustomerRecord(admin, {
        workspaceId,
        stripeCustomerId: customerId,
        email: session.customer_details?.email ?? session.customer_email ?? null,
        livemode: session.livemode,
        eventType: event.type,
      });

      if (subscriptionId) {
        let subscription: Stripe.Subscription | null = null;
        if (typeof session.subscription === "object" && session.subscription) {
          subscription = session.subscription as Stripe.Subscription;
        } else {
          subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
        }

        return syncSubscriptionFromStripeObject(admin, {
          subscription,
          eventType: event.type,
          workspaceIdHint: workspaceId,
        });
      }

      return {
        outcome: "processed",
        eventType: event.type,
        workspaceId,
      };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.resumed": {
      return syncSubscriptionFromStripeObject(admin, {
        subscription: event.data.object as Stripe.Subscription,
        eventType: event.type,
      });
    }
    case "invoice.created":
      return syncInvoiceFromStripeObject(admin, {
        invoice: event.data.object as Stripe.Invoice,
        eventType: event.type,
      });
    case "invoice.paid":
      return syncInvoiceFromStripeObject(admin, {
        invoice: event.data.object as Stripe.Invoice,
        eventType: event.type,
      });
    case "invoice.payment_failed":
      return syncInvoiceFromStripeObject(admin, {
        invoice: event.data.object as Stripe.Invoice,
        eventType: event.type,
        forceBillingStatus: "PAST_DUE",
      });
    default:
      return { outcome: "ignored", eventType: event.type };
  }
}

async function findExistingStripeWebhookEvent(admin: AdminClient, eventId: string) {
  return admin
    .from("integration_webhook_events")
    .select("id,status")
    .eq("provider", "stripe")
    .eq("dedupe_key", eventId)
    .maybeSingle();
}

async function insertStripeWebhookEvent(
  admin: AdminClient,
  input: {
    event: Stripe.Event;
    signature: string;
    metadata: Record<string, string | null>;
  },
) {
  return admin
    .from("integration_webhook_events")
    .insert(
      {
        workspace_id: input.metadata.workspaceId,
        provider: "stripe",
        external_event_id: input.event.id,
        webhook_signature: input.signature.slice(0, 64),
        status: "VERIFIED",
        payload: null,
        payload_hash: payloadHash(input.event),
        dedupe_key: input.event.id,
        metadata: input.metadata,
      } as never,
    )
    .select("id")
    .single();
}

async function markStripeWebhookEventStatus(
  admin: AdminClient,
  eventRowId: string,
  status: "PROCESSED" | "FAILED",
  metadata: Record<string, string | null>,
  errorCode?: string,
) {
  const { error } = await admin
    .from("integration_webhook_events")
    .update(
      {
        status,
        processed_at: new Date().toISOString(),
        last_error_code: errorCode ?? null,
        last_error_message: errorCode ?? null,
        metadata,
      } as never,
    )
    .eq("id", eventRowId);

  if (error) {
    throw new Error(`STRIPE_WEBHOOK_EVENT_UPDATE_FAILED:${error.message}`);
  }
}

export async function handleStripeWebhookRequest(input: {
  rawBody: string;
  signature: string | null;
  admin?: AdminClient;
  constructEvent?: typeof constructStripeWebhookEvent;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  let webhookSecret: string;
  try {
    webhookSecret = getStripeWebhookSecret();
  } catch {
    return {
      status: 500,
      body: {
        ok: false,
        error: "STRIPE_WEBHOOK_NOT_CONFIGURED:Webhook secret is missing.",
      },
    };
  }

  if (!input.signature) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "STRIPE_WEBHOOK_INVALID:Missing stripe-signature header.",
      },
    };
  }

  const construct = input.constructEvent ?? constructStripeWebhookEvent;
  let event: Stripe.Event;
  try {
    event = construct(input.rawBody, input.signature, webhookSecret);
  } catch {
    return {
      status: 400,
      body: {
        ok: false,
        error: "STRIPE_WEBHOOK_INVALID:Webhook signature verification failed.",
      },
    };
  }

  const admin = input.admin ?? createAdminClient();
  const existing = await findExistingStripeWebhookEvent(admin, event.id);
  const existingRow = existing.data as { id?: string | null; status?: string | null } | null;
  if (existingRow?.id) {
    return {
      status: 200,
      body: {
        ok: true,
        duplicate: true,
        eventType: event.type,
      },
    };
  }

  const baseMetadata = minimalEventMetadata({
    eventType: event.type,
    processingStatus: "received",
  });

  const inserted = await insertStripeWebhookEvent(admin, {
    event,
    signature: input.signature,
    metadata: baseMetadata,
  });

  const insertedRow = inserted.data as { id?: string | null } | null;
  if (inserted.error || !insertedRow?.id) {
    if (inserted.error?.message.includes("duplicate") || inserted.error?.message.includes("unique")) {
      return {
        status: 200,
        body: {
          ok: true,
          duplicate: true,
          eventType: event.type,
        },
      };
    }
    return {
      status: 500,
      body: {
        ok: false,
        error: "STRIPE_WEBHOOK_STORE_FAILED:Unable to record webhook event.",
      },
    };
  }

  try {
    const result = await processStripeWebhookEvent(admin, event);
    const metadata = minimalEventMetadata({
      eventType: event.type,
      workspaceId: "workspaceId" in result ? result.workspaceId : null,
      customerId: "customerId" in result ? result.customerId : null,
      processingStatus: result.outcome,
    });

    await markStripeWebhookEventStatus(admin, String(insertedRow.id), "PROCESSED", metadata);

    if (result.outcome === "ignored") {
      return {
        status: 200,
        body: {
          ok: true,
          ignored: true,
          eventType: event.type,
        },
      };
    }

    if (result.outcome === "unresolved_workspace") {
      return {
        status: 200,
        body: {
          ok: true,
          unresolvedWorkspace: true,
          eventType: event.type,
        },
      };
    }

    return {
      status: 200,
      body: {
        ok: true,
        eventType: event.type,
        workspaceId: result.workspaceId,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const safeCode = message.split(":")[0] || "STRIPE_WEBHOOK_PROCESS_FAILED";
    await markStripeWebhookEventStatus(
      admin,
      String(insertedRow.id),
      "FAILED",
      minimalEventMetadata({
        eventType: event.type,
        processingStatus: "failed",
      }),
      safeCode,
    );
    return {
      status: 500,
      body: {
        ok: false,
        error: `${safeCode}:Webhook processing failed.`,
      },
    };
  }
}
