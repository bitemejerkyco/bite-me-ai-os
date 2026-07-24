"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { signup, type AuthActionResult } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionResult = {
  success: false,
  message: "",
};

export function SignupForm({ setupMode }: { setupMode: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(signup, initialState);

  useEffect(() => {
    if (state.success) {
      router.push("/dashboard");
    }
  }, [router, state.success]);

  return (
    <form action={action} className="space-y-4" noValidate>
      {setupMode ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
          Authentication is running in setup mode. Add Supabase environment variables to enable sign-in.
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input id="signup-email" name="email" type="email" autoComplete="email" required disabled={pending} />
        {state.fieldErrors?.email ? <p className="text-sm text-rose-300">{state.fieldErrors.email[0]}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <Input id="signup-password" name="password" type="password" autoComplete="new-password" required minLength={8} disabled={pending} />
        {state.fieldErrors?.password ? <p className="text-sm text-rose-300">{state.fieldErrors.password[0]}</p> : null}
      </div>

      {state.message ? <p className={`text-sm ${state.success ? "text-emerald-300" : "text-rose-300"}`}>{state.message}</p> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account..." : "Create account"}
      </Button>

      <div className="text-right text-sm text-zinc-400">
        <Link href="/login" className="hover:text-zinc-100">Already have an account?</Link>
      </div>
    </form>
  );
}
