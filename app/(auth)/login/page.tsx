import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <AuthCard
      title="Welcome back"
      description="Access your platform workspace with your email and password."
      footer={
        <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
          <Link className="transition hover:text-white" href="/signup">
            Create account
          </Link>
          <Link className="transition hover:text-white" href="/forgot-password">
            Forgot password?
          </Link>
        </div>
      }
    >
      <LoginForm />
    </AuthCard>
  );
}
