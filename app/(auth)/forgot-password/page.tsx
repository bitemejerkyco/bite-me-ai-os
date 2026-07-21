import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { isSupabaseConfigured } from "@/lib/env";

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset password" description="We will email a secure link so you can set a new password.">
      <ForgotPasswordForm setupMode={!isSupabaseConfigured} />
    </AuthCard>
  );
}
