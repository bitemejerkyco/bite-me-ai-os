import { NextResponse } from "next/server";
import { isDatabaseConfigured, isSupabaseConfigured } from "@/lib/env";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "postmotive-ai",
      databaseConfigured: isDatabaseConfigured,
      supabaseConfigured: isSupabaseConfigured,
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
