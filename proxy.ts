import type { NextRequest } from "next/server";
import { handleSupabaseProxy } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return handleSupabaseProxy(request);
}

export const config = {
  // Exclude health checks, Next.js internals, favicon, and common image assets from proxy auth checks.
  matcher: ["/((?!api/health|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)"],
};
