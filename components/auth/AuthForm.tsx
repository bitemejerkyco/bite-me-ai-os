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
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111827] p-6 shadow-2xl md:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-400">PostMotive</p>
      <h1 className="mt-2 text-3xl font-black">{mode === "SIGN_IN" ? "Sign in" : "Create account"}</h1>
      <p className="mt-2 text-sm text-zinc-400">Secure access to your marketing workspace.</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === "SIGN_UP" ? (
          <label className="block text-sm text-zinc-300">
            Full name
            <input required value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5" />
          </label>
        ) : null}
        <label className="block text-sm text-zinc-300">
          Email
          <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5" />
        </label>
        <label className="block text-sm text-zinc-300">
          Password
          <input required minLength={8} type="password" autoComplete={mode === "SIGN_IN" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5" />
        </label>
        <button disabled={working} className="w-full rounded-lg bg-red-600 px-5 py-3 font-semibold hover:bg-red-500 disabled:opacity-60">
          {working ? "Please wait…" : mode === "SIGN_IN" ? "Sign in" : "Create secure account"}
        </button>
      </form>

      {error ? <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
      {message ? <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p> : null}

      <button onClick={() => {
        setMode(mode === "SIGN_IN" ? "SIGN_UP" : "SIGN_IN");
        setError("");
        setMessage("");
      }} className="mt-6 text-sm text-zinc-400 underline hover:text-white">
        {mode === "SIGN_IN" ? "Create a new account" : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
