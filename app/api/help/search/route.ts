import { NextRequest, NextResponse } from "next/server";
import { searchHelpIndex } from "@/features/help/search";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || "";
  return NextResponse.json({ ok: true, results: searchHelpIndex(query) });
}
