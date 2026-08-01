import { NextRequest, NextResponse } from "next/server";
import { loadHelpContext } from "@/features/help/server";

export async function GET(request: NextRequest) {
  const route = request.nextUrl.searchParams.get("route") || "/";
  try {
    const data = await loadHelpContext(route);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
