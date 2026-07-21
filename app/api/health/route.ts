import { NextResponse } from "next/server";
import { isDatabaseConfigured, isSupabaseConfigured } from "@/lib/env";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      database: isDatabaseConfigured,
      supabase: isSupabaseConfigured,
    },
  });
}
