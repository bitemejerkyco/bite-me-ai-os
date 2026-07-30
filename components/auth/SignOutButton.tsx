"use client";

import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  return (
    <button
      onClick={async () => {
        await createClient().auth.signOut();
        window.location.href = "/login";
      }}
      className="mt-3 w-full rounded-lg border border-white/10 px-3 py-2 text-left text-xs text-zinc-400 hover:bg-white/5 hover:text-white"
    >
      Sign out
    </button>
  );
}

