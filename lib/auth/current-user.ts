import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export type AuthenticatedUser = {
  id: string;
  email: string | null;
};

export type CurrentUserState =
  | { mode: "setup"; user: null }
  | { mode: "anonymous"; user: null }
  | { mode: "authenticated"; user: AuthenticatedUser };

export async function getCurrentUserState(): Promise<CurrentUserState> {
  if (!isSupabaseConfigured) {
    return { mode: "setup", user: null };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { mode: "setup", user: null };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { mode: "anonymous", user: null };
  }

  return {
    mode: "authenticated",
    user: {
      id: user.id,
      email: user.email ?? null,
    },
  };
}
