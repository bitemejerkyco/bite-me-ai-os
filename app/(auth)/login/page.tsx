import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { isSupabaseConfigured } from "@/lib/env";

export default function LoginPage() {
  return (
    <AuthCard title="Welcome back" description="Sign in to access your marketing operations workspace.">
      <LoginForm setupMode={!isSupabaseConfigured} />
    </AuthCard>
  );
}
