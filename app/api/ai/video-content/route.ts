import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const PUBLIC_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{8,200}$/;

async function getAuthedSupabase() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user || null };
}

export async function GET(request: Request) {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id") || "";
  if (!PUBLIC_VIDEO_ID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid video request." }, { status: 400 });
  }

  const projectById = await supabase
    .from("video_projects")
    .select("id,provider_job_id,video_storage_path,status")
    .eq("id", id)
    .maybeSingle();
  if (projectById.error) {
    return NextResponse.json({ error: projectById.error.message }, { status: 400 });
  }

  const project = projectById.data
    ? projectById.data
    : (
        await supabase
          .from("video_projects")
          .select("id,provider_job_id,video_storage_path,status")
          .eq("provider_job_id", id)
          .maybeSingle()
      ).data;

  if (!project) {
    return NextResponse.json({ error: "Video project not found." }, { status: 404 });
  }

  if (project.video_storage_path) {
    const signed = await supabase.storage.from("brand-media").createSignedUrl(String(project.video_storage_path), 60 * 60);
    if (!signed.data?.signedUrl || signed.error) {
      return NextResponse.json({ error: "The finished video is not available." }, { status: 404 });
    }
    const upstream = await fetch(signed.data.signedUrl, { cache: "no-store" });
    if (!upstream.ok) {
      return NextResponse.json({ error: "The finished video is not available." }, { status: upstream.status });
    }
    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "video/mp4",
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'inline; filename="postmotive-video.mp4"',
      },
    });
  }

  const env = getServerEnv();
  if (!env.openAiApiKey || !project.provider_job_id) {
    return NextResponse.json({ error: "The finished video is not available." }, { status: 404 });
  }

  const upstream = await fetch(
    `https://api.openai.com/v1/videos/${project.provider_job_id}/content`,
    {
      headers: { Authorization: `Bearer ${env.openAiApiKey}` },
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
