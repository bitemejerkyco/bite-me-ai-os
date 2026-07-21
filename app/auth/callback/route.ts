import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!isSupabaseConfigured || !code) {
    return NextResponse.redirect(new URL(isSupabaseConfigured ? "/login" : "/dashboard", url));
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      logger.warn("Supabase callback exchange failed", error.message);
      return NextResponse.redirect(new URL("/login", url));
    }

    return NextResponse.redirect(new URL("/dashboard", url));
  } catch (error) {
    logger.error("Unexpected auth callback failure", error);
    return NextResponse.redirect(new URL("/login", url));
  }
}
