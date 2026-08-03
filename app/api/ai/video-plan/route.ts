import { NextResponse } from "next/server";
import { extractResponseText } from "@/features/core/ai-content";
import {
  buildVideoPlanningPrompt,
  parseVideoPlanInput,
  parseVideoPlanResponse,
  VIDEO_PROMPT_VERSION,
} from "@/features/core/video-project";
import { createClient } from "@/lib/supabase/server";
import { buildAgentPrompt } from "@/features/core/agent-prompts";

type ProductAssetMetadata = {
  productId?: string;
  productName?: string;
  assetRole?: "PRIMARY" | "ALTERNATE" | "REFERENCE";
  isPrimaryProductImage?: boolean;
  role?: "PRIMARY" | "ALTERNATE" | "REFERENCE";
  angle?: string;
  locked?: boolean;
  approvedForGeneration?: boolean;
  transparentBackground?: boolean;
  originalAssetId?: string;
  exactProductMode?: boolean;
  allowAiMotion?: boolean;
  preserveOriginalAsset?: boolean;
  originalStoragePath?: string;
  background?: string;
  position?: string;
  scale?: string;
  safeArea?: string;
  notes?: string;
};

type ProductAssetRow = {
  id: string;
  file_name: string;
  storage_path: string;
  metadata: Record<string, unknown> | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI is not configured." },
      { status: 503 },
    );
  }
  const input = parseVideoPlanInput(await request.json().catch(() => null));
  if (!input) {
    return NextResponse.json(
      { error: "Complete the video brief first." },
      { status: 400 },
    );
  }
  let planInput = input;
  if (input.productAsset?.id) {
    const workspaceId = String((await supabase.rpc("my_primary_workspace_id")).data || "").trim();
    const { data: productRow, error } = await supabase
      .from("media_assets")
      .select("id,file_name,storage_path,metadata")
      .eq("workspace_id", workspaceId)
      .eq("id", input.productAsset.id)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const row = productRow as ProductAssetRow | null;
    const rawMetadata = row?.metadata && typeof row.metadata === "object"
      ? (row.metadata.productAsset && typeof row.metadata.productAsset === "object"
        ? row.metadata.productAsset
        : row.metadata)
      : null;
    const requestMetadata = input.productAsset.productMetadata || {};
    const productMetadata = {
      ...(rawMetadata && typeof rawMetadata === "object" ? rawMetadata : {}),
      ...requestMetadata,
    } as ProductAssetMetadata;
    if (!productMetadata?.approvedForGeneration) {
      return NextResponse.json(
        { error: "Select an approved product image before using exact product mode." },
        { status: 400 },
      );
    }
    if (planInput.allowAiProductMotion && productMetadata.allowAiMotion !== true) {
      return NextResponse.json(
        { error: "AI product motion needs an explicit approval on the product asset." },
        { status: 400 },
      );
    }
    planInput = {
      ...planInput,
      productAsset: {
        id: row?.id || input.productAsset.id,
        name: row?.file_name || input.productAsset.name,
        storagePath: row?.storage_path || input.productAsset.storagePath,
        productMetadata,
      },
      exactProductMode: true,
    };
  }
  const model = process.env.OPENAI_MODEL || "gpt-5.6-sol";
  const upstream = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions:
        "You are PostMotive's vertical-video planning engine. Return valid JSON only and obey all brand, rights, and compliance constraints.",
      input: buildAgentPrompt({
        jobType: "VIDEO_PLAN",
        businessName: input.workspace.businessName,
        channel: input.channel,
        objective: input.objective,
        roles: [
          "PROMPT_DIRECTOR",
          "BRAND_STRATEGIST",
          "CHANNEL_SPECIALIST",
          "CREATIVE_DIRECTOR",
          "COPYWRITER",
          "COMPLIANCE_REVIEWER",
        ],
        facts: [
          `Website: ${input.workspace.website || "not supplied"}`,
          `Audience: ${input.workspace.audience || "not supplied"}`,
          `Brand voice: ${input.workspace.voice || "not supplied"}`,
          `Industry: ${input.workspace.industry}`,
          `Duration: ${input.durationSeconds} seconds`,
          `Voice: ${input.voice}`,
          `Music mode: ${input.musicMode}`,
            planInput.productAsset ? `Product asset: ${planInput.productAsset.name} (${planInput.productAsset.id})` : "Product asset: none supplied",
        ],
        constraints: [
          "Create original 9:16 vertical-video material.",
          "Do not use real-person likenesses, celebrities, copyrighted characters, copyrighted music, or third-party watermarks.",
          "Never invent prices, discounts, certifications, testimonials, legal approval, or product claims.",
          "Include readable on-screen captions and a safe human-review note.",
            planInput.productAsset ? "Use the supplied product asset as the authoritative visual reference. Preserve packaging, logos, and copy exactly." : "",
        ],
        requiredOutput: [
          "Return strict JSON only.",
          "Include title, script, caption, renderPrompt, complianceNote, and scenes.",
          "Scene durations must total the requested duration.",
        ],
        task: buildVideoPlanningPrompt({
          ...planInput,
          exactProductMode: planInput.exactProductMode || Boolean(planInput.productAsset),
          allowAiProductMotion: Boolean(planInput.allowAiProductMotion),
        }),
      }),
      max_output_tokens: 1800,
    }),
    cache: "no-store",
  });
  const payload: unknown = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    return NextResponse.json(
      { error: "OpenAI could not create the video plan." },
      { status: upstream.status },
    );
  }
  const plan = parseVideoPlanResponse(extractResponseText(payload));
  if (!plan) {
    return NextResponse.json(
      { error: "The video plan was incomplete. Please try again." },
      { status: 502 },
    );
  }
  return NextResponse.json({
    ...plan,
    hashtags: plan.hashtags,
    callToAction: plan.callToAction,
    model,
    promptVersion: VIDEO_PROMPT_VERSION,
  });
}
