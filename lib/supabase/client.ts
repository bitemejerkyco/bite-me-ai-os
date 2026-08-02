import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/env";

export function createClient() {
  const { supabaseUrl, supabasePublishableKey } = getSupabasePublicConfig();

  return createBrowserClient(
    supabaseUrl,
    supabasePublishableKey,
  );
}

