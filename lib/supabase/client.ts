import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if (!isSupabaseConfigured || !env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_PUBLIC_KEY) {
    return null;
  }

  if (!browserClient) {
    browserClient = createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_PUBLIC_KEY);
  }

  return browserClient;
}
