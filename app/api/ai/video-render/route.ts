import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VIDEO_ID_PATTERN = /^video_[A-Za-z0-9_-]{8,200}$/;

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ? supabase : null;
}

export async function POST(request: Request) {
  const supabase = await requireUser();
  if (!supabase) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI is not configured." }, { status: 503 });
  }
  const body = (await request.json().catch(() => null)) as {
    prompt?: unknown;
    seconds?: unknown;
    sourceVideoId?: unknown;
  } | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const seconds = Number(body?.seconds);
  const sourceVideoId =
    typeof body?.sourceVideoId === "string" ? body.sourceVideoId : "";
  if (!prompt || prompt.length > 4_000 || ![8, 16, 20].includes(seconds)) {
    return NextResponse.json({ error: "Invalid video render request." }, { status: 400 });
  }
  if (sourceVideoId && !VIDEO_ID_PATTERN.test(sourceVideoId)) {
    return NextResponse.json({ error: "Invalid source video ID." }, { status: 400 });
  }
  const creditRequestId = crypto.randomUUID();
  const { data: reservationData, error: reservationError } =
    await supabase.rpc("reserve_my_video_credits", {
      video_seconds: seconds,
      credit_request_id: creditRequestId,
    });
  if (reservationError) {
    return NextResponse.json(
      { error: reservationError.message },
      { status: 402 },
    );
  }
  const reservation = Array.isArray(reservationData)
    ? reservationData[0]
    : reservationData;

  let upstream: Response;
  try {
    upstream = await fetch(
      sourceVideoId
        ? "https://api.openai.com/v1/videos/edits"
        : "https://api.openai.com/v1/videos",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          sourceVideoId
            ? {
                video: { id: sourceVideoId },
                prompt,
              }
            : {
                model: "sora-2-pro",
                prompt,
                size: "1080x1920",
                seconds: String(seconds),
              },
        ),
        cache: "no-store",
      },
    );
  } catch {
    await supabase.rpc("refund_my_video_credits", {
      credit_request_id: creditRequestId,
      refund_reason: "Provider request could not be reached.",
    });
    return NextResponse.json(
      { error: "Video provider could not be reached. Reserved credits were returned." },
      { status: 502 },
    );
  }
  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    await supabase.rpc("refund_my_video_credits", {
      credit_request_id: creditRequestId,
      refund_reason: `Provider rejected render start with status ${upstream.status}.`,
    });
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: { message?: string } }).error?.message || "")
        : "";
    return NextResponse.json(
      { error: message || "Video generation could not start." },
      { status: upstream.status },
    );
  }
  return NextResponse.json({
    ...(payload && typeof payload === "object" ? payload : {}),
    creditUsage: {
      chargedCredits: Number(reservation?.charged_credits || 0),
      remainingCredits: Number(reservation?.remaining_credits || 0),
      monthlyUsedCredits: Number(
        reservation?.monthly_used_credits || 0,
      ),
      monthlyLimitCredits: Number(
        reservation?.monthly_limit_credits || 0,
      ),
      billingExempt: Boolean(reservation?.billing_exempt),
      estimatedProviderCostCents: Number(
        reservation?.estimated_provider_cost_cents || 0,
      ),
    },
  });
}

export async function GET(request: Request) {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI is not configured." }, { status: 503 });
  }
  const videoId = new URL(request.url).searchParams.get("id") || "";
  if (!VIDEO_ID_PATTERN.test(videoId)) {
    return NextResponse.json({ error: "Invalid video ID." }, { status: 400 });
  }
  const upstream = await fetch(`https://api.openai.com/v1/videos/${videoId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  const payload = await upstream.json().catch(() => null);
  return NextResponse.json(payload || { error: "Empty video status." }, {
    status: upstream.status,
  });
}

export async function DELETE(request: Request) {
  if (!(await requireUser())) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI is not configured." }, { status: 503 });
  }
  const videoId = new URL(request.url).searchParams.get("id") || "";
  if (!VIDEO_ID_PATTERN.test(videoId)) {
    return NextResponse.json({ error: "Invalid video ID." }, { status: 400 });
  }
  const upstream = await fetch(`https://api.openai.com/v1/videos/${videoId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });
  const payload = await upstream.json().catch(() => null);
  return NextResponse.json(payload || { deleted: upstream.ok }, {
    status: upstream.status,
  });
}
