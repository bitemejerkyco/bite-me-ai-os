import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

let adminClient: ReturnType<typeof createClient> | null = null;

export function createAdminClient() {
  const { supabaseUrl, supabaseServiceRoleKey } = getServerEnv();

  if (!adminClient) {
    adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}