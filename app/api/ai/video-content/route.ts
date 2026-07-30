import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VIDEO_ID_PATTERN = /^video_[A-Za-z0-9_-]{8,200}$/;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  const videoId = new URL(request.url).searchParams.get("id") || "";
  if (!apiKey || !VIDEO_ID_PATTERN.test(videoId)) {
    return NextResponse.json({ error: "Invalid video request." }, { status: 400 });
  }
  const upstream = await fetch(
    `https://api.openai.com/v1/videos/${videoId}/content`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    },
  );
  if (!upstream.ok) {
    return NextResponse.json(
      { error: "The finished video is not available." },
      { status: upstream.status },
    );
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "video/mp4",
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'inline; filename="postmotive-video.mp4"',
    },
  });
}

