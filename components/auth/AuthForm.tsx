"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthForm() {
  const [mode, setMode] = useState<"SIGN_IN" | "SIGN_UP">("SIGN_IN");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setWorking(true);
    setError("");
    setMessage("");
    const supabase = createClient();

    if (mode === "SIGN_UP") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });
      if (signUpError) setError(signUpError.message);
      else if (data.session) window.location.href = "/";
      else setMessage("Check your email and click the confirmation link.");
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) setError(signInError.message);
      else window.location.href = "/";
    }

    setWorking(false);
  };

  return (
    <div className="pm-glass relative z-10 w-full max-w-md rounded-[2rem] p-7 md:p-9">
      <p className="pm-brand text-xs font-black uppercase tracking-[0.22em]">PostMotive</p>
      <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-slate-900">{mode === "SIGN_IN" ? "Welcome back" : "Create account"}</h1>
      <p className="mt-2 text-sm text-slate-500">Your marketing workspace is ready when you are.</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === "SIGN_UP" ? (
          <label className="block text-sm font-medium text-slate-700">
            Full name
            <input required value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-3" />
          </label>
        ) : null}
        <label className="block text-sm font-medium text-slate-700">
          Email
          <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-3" />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Password
          <input required minLength={8} type="password" autoComplete={mode === "SIGN_IN" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-3" />
        </label>
        <button disabled={working} className="pm-primary-button w-full rounded-2xl px-5 py-3 font-semibold disabled:opacity-60">
          {working ? "Please wait…" : mode === "SIGN_IN" ? "Sign in" : "Create secure account"}
        </button>
      </form>

      {error ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}
      {message ? <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}

      <button onClick={() => {
        setMode(mode === "SIGN_IN" ? "SIGN_UP" : "SIGN_IN");
        setError("");
        setMessage("");
      }} className="mt-6 text-sm text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-violet-700">
        {mode === "SIGN_IN" ? "Create a new account" : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
