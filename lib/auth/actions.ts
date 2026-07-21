"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export type AuthActionResult = {
  success: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const signupSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

function setupModeResult(): AuthActionResult {
  return {
    success: false,
    message: "Authentication is running in setup mode. Add Supabase environment variables to enable sign-in.",
  };
}

function invalidCredentialsResult(): AuthActionResult {
  return {
    success: false,
    message: "Invalid email or password.",
  };
}

export async function login(_: AuthActionResult, formData: FormData): Promise<AuthActionResult> {
  if (!isSupabaseConfigured) return setupModeResult();

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) return invalidCredentialsResult();

    return {
      success: true,
      message: "Signed in successfully.",
    };
  } catch {
    return {
      success: false,
      message: "Unable to sign in right now. Please try again.",
    };
  }
}

export async function signup(_: AuthActionResult, formData: FormData): Promise<AuthActionResult> {
  if (!isSupabaseConfigured) return setupModeResult();

  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      return {
        success: false,
        message: "Unable to create your account. Please try again.",
      };
    }

    return {
      success: true,
      message: "Account created. Check your email to confirm your account.",
    };
  } catch {
    return {
      success: false,
      message: "Unable to create your account right now. Please try again.",
    };
  }
}

export async function requestPasswordReset(_: AuthActionResult, formData: FormData): Promise<AuthActionResult> {
  if (!isSupabaseConfigured) return setupModeResult();

  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${origin}/auth/callback?next=/settings`,
    });

    return {
      success: true,
      message: "If an account exists, a password reset link has been sent.",
    };
  } catch {
    return {
      success: false,
      message: "Unable to request password reset right now. Please try again.",
    };
  }
}

export async function logout(): Promise<AuthActionResult> {
  if (!isSupabaseConfigured) {
    return {
      success: true,
      message: "Signed out.",
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    return {
      success: true,
      message: "Signed out.",
    };
  } catch {
    return {
      success: false,
      message: "Unable to sign out right now.",
    };
  }
}
