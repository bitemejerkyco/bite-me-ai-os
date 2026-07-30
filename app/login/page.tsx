import AuthForm from "@/components/auth/AuthForm";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#090d14] p-5 text-white">
      <AuthForm />
      <nav
        aria-label="Legal"
        className="flex gap-5 text-sm text-slate-400"
      >
        <Link className="hover:text-white" href="/terms">
          Terms of Service
        </Link>
        <Link className="hover:text-white" href="/privacy">
          Privacy Policy
        </Link>
      </nav>
    </main>
  );
}
