import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

function safeNextPath(nextPath: string | null) {
  if (!nextPath) return "/dashboard";
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) return "/dashboard";
  return nextPath;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next"));
  const destination = new URL(next, requestUrl.origin);

  if (!isSupabaseConfigured) {
    destination.pathname = "/login";
    destination.searchParams.set("message", "supabase-not-configured");
    return NextResponse.redirect(destination);
  }

  if (!code) {
    destination.pathname = "/login";
    destination.searchParams.set("message", "invalid-auth-callback");
    return NextResponse.redirect(destination);
  }

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
    return NextResponse.redirect(destination);
  } catch {
    const failureUrl = new URL("/login", requestUrl.origin);
    failureUrl.searchParams.set("message", "auth-callback-failed");
    return NextResponse.redirect(failureUrl);
  }
}
