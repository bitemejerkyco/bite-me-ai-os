import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env, isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";

export async function createServerSupabaseClient() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase server client cannot be created without valid configuration.");
  }

  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (error) {
          if (process.env.NODE_ENV !== "production") {
            logger.warn("Supabase cookie write skipped during server rendering", error);
          }
          
          // Server Components cannot always write cookies; refresh is handled in proxy.ts.
        }
      },
    },
  });
}
