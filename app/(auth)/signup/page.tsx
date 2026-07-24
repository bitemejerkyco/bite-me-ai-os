import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";
import { isSupabaseConfigured } from "@/lib/env";

export default function SignupPage() {
  return (
    <AuthCard title="Create your account" description="Start building your AI-powered marketing operations hub.">
      <SignupForm setupMode={!isSupabaseConfigured} />
    </AuthCard>
  );
}
