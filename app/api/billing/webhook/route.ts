import { NextRequest, NextResponse } from "next/server";
import { handleStripeWebhookRequest } from "@/features/billing/stripe-webhook";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const result = await handleStripeWebhookRequest({
    rawBody,
    signature,
  });

  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "cache-control": "no-store" },
  });
}
