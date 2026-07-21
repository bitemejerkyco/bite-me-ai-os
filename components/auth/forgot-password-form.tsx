"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type AuthActionResult } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionResult = {
  success: false,
  message: "",
};

export function ForgotPasswordForm({ setupMode }: { setupMode: boolean }) {
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <form action={action} className="space-y-4" noValidate>
      {setupMode ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          Authentication is running in setup mode. Add Supabase environment variables to enable sign-in.
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="forgot-email">Email</Label>
        <Input id="forgot-email" name="email" type="email" autoComplete="email" required disabled={pending} />
        {state.fieldErrors?.email ? <p className="text-sm text-rose-300">{state.fieldErrors.email[0]}</p> : null}
      </div>

      {state.message ? <p className={`text-sm ${state.success ? "text-emerald-300" : "text-rose-300"}`}>{state.message}</p> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending..." : "Send reset link"}
      </Button>

      <div className="text-right text-sm text-zinc-400">
        <Link href="/login" className="hover:text-zinc-100">Back to sign in</Link>
      </div>
    </form>
  );
}
