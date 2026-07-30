import AuthForm from "@/components/auth/AuthForm";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden p-5 text-slate-900">
      <div className="pointer-events-none absolute -left-24 top-10 h-80 w-80 rounded-[45%_55%_63%_37%] bg-pink-200/60 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-96 w-96 rounded-[58%_42%_36%_64%] bg-cyan-200/60 blur-3xl" />
      <AuthForm />
      <nav
        aria-label="Legal"
        className="relative z-10 flex gap-5 text-sm text-slate-500"
      >
        <Link className="hover:text-violet-700" href="/terms">
          Terms of Service
        </Link>
        <Link className="hover:text-violet-700" href="/privacy">
          Privacy Policy
        </Link>
      </nav>
    </main>
  );
}
