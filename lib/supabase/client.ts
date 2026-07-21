import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

export function createBrowserSupabaseClient() {
  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey } =
    publicEnv;

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase browser client cannot be created because NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are missing.",
    );
  }

  return createBrowserClient(url, publishableKey);
}
