import { NextResponse } from "next/server";
import { isVideoVoice } from "@/features/core/video-project";
import { createClient } from "@/lib/supabase/server";

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
  const body = (await request.json().catch(() => null)) as {
    text?: unknown;
    voice?: unknown;
    instructions?: unknown;
  } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 4_000 || !isVideoVoice(body?.voice)) {
    return NextResponse.json(
      { error: "Add a valid voiceover script and voice." },
      { status: 400 },
    );
  }
  const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: body.voice,
      input: text,
      instructions:
        typeof body.instructions === "string"
          ? body.instructions.slice(0, 500)
          : "Deliver a natural, energetic commercial voiceover. Do not imitate a real person.",
      response_format: "mp3",
    }),
    cache: "no-store",
  });
  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Voiceover generation failed." },
      { status: upstream.status },
    );
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      "Content-Disposition": 'inline; filename="postmotive-voiceover.mp3"',
    },
  });
}

