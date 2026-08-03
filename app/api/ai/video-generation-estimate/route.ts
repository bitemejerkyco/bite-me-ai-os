import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadVideoRouterSettings } from "@/features/core/video-router-settings";
import { resolveVideoRouterProfile } from "@/features/core/video-router";
import { quoteVideoCredits } from "@/features/core/video-credits";
import {
  estimateVideoGenerationTimeSeconds,
  formatEstimateDurationLabel,
  formatProviderModelDisplay,
  normalizeRequestedVideoQualityTier,
  VIDEO_QUALITY_DESCRIPTORS,
} from "@/features/core/video-generation-quality";
import type { VideoProject } from "@/features/core/video-project";

function asDuration(value: string | null): VideoProject["durationSeconds"] | null {
  const parsed = Number(value || "");
  return [8, 9, 10, 11, 12, 13, 14, 15].includes(parsed)
    ? (parsed as VideoProject["durationSeconds"])
    : null;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const duration = asDuration(params.get("durationSeconds"));
  const tier = normalizeRequestedVideoQualityTier(params.get("tier"));

  if (!duration) {
    return NextResponse.json({ error: "Unsupported video duration." }, { status: 400 });
  }
  if (!tier) {
    return NextResponse.json({ error: "Invalid generation quality tier." }, { status: 400 });
  }

  const settings = await loadVideoRouterSettings();
  const profile = resolveVideoRouterProfile({
    requestedTier: tier,
    mode: settings.mode,
    seconds: duration,
    settings,
  });

  const creditQuote = quoteVideoCredits(duration);
  const generationEstimate = estimateVideoGenerationTimeSeconds({
    tier: profile.tier,
    durationSeconds: duration,
  });
  const descriptor = VIDEO_QUALITY_DESCRIPTORS[profile.tier];

  return NextResponse.json({
    ok: true,
    tier: profile.tier,
    tierLabel: descriptor.label,
    description: descriptor.description,
    estimatedCredits: creditQuote.requiredCredits,
    estimatedProviderCostCents: duration * profile.estimatedCostCentsPerSecond,
    estimatedProviderCostUsd: Number((duration * profile.estimatedCostCentsPerSecond / 100).toFixed(2)),
    expectedGenerationTime: {
      minSeconds: generationEstimate.minSeconds,
      maxSeconds: generationEstimate.maxSeconds,
      label: formatEstimateDurationLabel(generationEstimate),
    },
    providerDisplayName: formatProviderModelDisplay(profile),
    model: profile.model,
    providerKey: profile.providerKey,
    estimateDisclaimer: "Estimates only. Final usage and provider cost can vary.",
  });
}
