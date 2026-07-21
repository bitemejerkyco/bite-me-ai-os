"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { login, type AuthActionResult } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthActionResult = {
  success: false,
  message: "",
};

export function LoginForm({ setupMode }: { setupMode: boolean }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(login, initialState);

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
        <Label htmlFor="login-email">Email</Label>
        <Input id="login-email" name="email" type="email" autoComplete="email" required disabled={pending} />
        {state.fieldErrors?.email ? <p className="text-sm text-rose-300">{state.fieldErrors.email[0]}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="login-password">Password</Label>
        <Input id="login-password" name="password" type="password" autoComplete="current-password" required minLength={8} disabled={pending} />
        {state.fieldErrors?.password ? <p className="text-sm text-rose-300">{state.fieldErrors.password[0]}</p> : null}
      </div>

      {state.message ? <p className={`text-sm ${state.success ? "text-emerald-300" : "text-rose-300"}`}>{state.message}</p> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </Button>

      <div className="flex items-center justify-between text-sm text-zinc-400">
        <Link href="/forgot-password" className="hover:text-zinc-100">Forgot password?</Link>
        <Link href="/signup" className="hover:text-zinc-100">Create account</Link>
      </div>
    </form>
  );
}
