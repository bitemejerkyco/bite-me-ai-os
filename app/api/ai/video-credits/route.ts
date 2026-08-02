import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type CreditStatusRow = {
  balance_credits: number;
  monthly_limit_credits: number;
  monthly_used_credits: number;
  billing_exempt: boolean;
  credits_per_second: number;
  provider_cost_cents_per_second: number;
};

export async function GET() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("get_my_video_credit_status");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | CreditStatusRow
    | undefined;
  if (!row) {
    return NextResponse.json(
      { error: "Video credit account is unavailable." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    balanceCredits: Number(row.balance_credits),
    monthlyLimitCredits: Number(row.monthly_limit_credits),
    monthlyUsedCredits: Number(row.monthly_used_credits),
    billingExempt: Boolean(row.billing_exempt),
    creditsPerSecond: Number(row.credits_per_second),
  });
}
