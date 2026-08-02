"use client";

import { createClient } from "@/lib/supabase/client";
import { clearWorkspaceClientCache } from "@/features/core/local-os";

export default function SignOutButton() {
  return (
    <button
      onClick={async () => {
        await createClient().auth.signOut();
        clearWorkspaceClientCache();
        window.location.href = "/login";
      }}
      className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-500 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
    >
      Sign out
    </button>
  );
}
