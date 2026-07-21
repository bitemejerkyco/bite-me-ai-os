import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <AuthCard
      title="Create your account"
      description="Set up access for the Bite Me AI OS platform foundation."
      footer={
        <p className="text-sm text-slate-300">
          Already have an account?{" "}
          <Link className="font-medium text-white transition hover:text-rose-200" href="/login">
            Sign in
          </Link>
        </p>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
