import type { NextRequest } from "next/server";
import { handleSupabaseProxy } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return handleSupabaseProxy(request);
}

export const config = {
  matcher: ["/((?!api/health|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)"],
};
