import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildTextlessFrameConstraint,
  validateCreativeSpec,
} from "@/features/core/creative-spec";
import {
  listTemplatesForMode,
  resolveCreatorTemplate,
} from "@/features/core/creator-template-catalog";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    spec?: unknown;
  } | null;

  const result = validateCreativeSpec(body?.spec || null);
  if (!result.valid || !result.spec) {
    return NextResponse.json(
      {
        ok: false,
        errors: result.errors,
      },
      { status: 400 },
    );
  }

  const template = resolveCreatorTemplate(result.spec.templateId);
  return NextResponse.json({
    ok: true,
    spec: result.spec,
    template,
    allowedTemplatesForMode: listTemplatesForMode(result.spec.creationMode),
    constraints: {
      deterministicTextRendering: buildTextlessFrameConstraint(),
    },
  });
}
