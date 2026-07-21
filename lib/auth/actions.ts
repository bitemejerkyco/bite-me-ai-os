"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AuthActionResult = {
  success: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

const emailSchema = z.string().email("Enter a valid email address.");
const passwordSchema = z.string().min(8, "Password must be at least 8 characters.");

const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

const signupSchema = loginSchema.extend({
  confirmPassword: passwordSchema,
});

const forgotPasswordSchema = z.object({
  email: emailSchema,
});

function fromValidationError(error: z.ZodError): AuthActionResult {
  return {
    success: false,
    message: "Please correct the highlighted fields.",
    fieldErrors: error.flatten().fieldErrors,
  };
}

async function getRequestOrigin() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");

  if (origin) {
    return origin;
  }

  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

export async function login(values: unknown): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(values);

  if (!parsed.success) {
    return fromValidationError(parsed.error);
  }

  if (!isSupabaseConfigured) {
    return {
      success: true,
      message: "Supabase is not configured. Continuing in local demo mode.",
    };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);

    if (error) {
      return {
        success: false,
        message: error.message,
      };
    }

    revalidatePath("/", "layout");
    return {
      success: true,
      message: "Signed in successfully.",
    };
  } catch (error) {
    logger.error("Login action failed", error);
    return {
      success: false,
      message: "Unable to sign in right now.",
    };
  }
}

export async function signup(values: unknown): Promise<AuthActionResult> {
  const parsed = signupSchema.safeParse(values);

  if (!parsed.success) {
    return fromValidationError(parsed.error);
  }

  if (parsed.data.password !== parsed.data.confirmPassword) {
    return {
      success: false,
      message: "Passwords must match.",
      fieldErrors: {
        confirmPassword: ["Passwords must match."],
      },
    };
  }

  if (!isSupabaseConfigured) {
    return {
      success: true,
      message: "Supabase is not configured. Demo access is available locally.",
    };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${await getRequestOrigin()}/auth/callback`,
      },
    });

    if (error) {
      return {
        success: false,
        message: error.message,
      };
    }

    revalidatePath("/", "layout");
    return {
      success: true,
      message: "Account created. Check your email if confirmation is required.",
    };
  } catch (error) {
    logger.error("Signup action failed", error);
    return {
      success: false,
      message: "Unable to create your account right now.",
    };
  }
}

export async function logout(): Promise<AuthActionResult> {
  if (!isSupabaseConfigured) {
    return {
      success: true,
      message: "Demo mode closed.",
    };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return {
        success: false,
        message: error.message,
      };
    }

    revalidatePath("/", "layout");
    return {
      success: true,
      message: "Signed out successfully.",
    };
  } catch (error) {
    logger.error("Logout action failed", error);
    return {
      success: false,
      message: "Unable to sign out right now.",
    };
  }
}

export async function requestPasswordReset(values: unknown): Promise<AuthActionResult> {
  const parsed = forgotPasswordSchema.safeParse(values);

  if (!parsed.success) {
    return fromValidationError(parsed.error);
  }

  if (!isSupabaseConfigured) {
    return {
      success: true,
      message: "Supabase is not configured. Password reset is unavailable in demo mode.",
    };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${await getRequestOrigin()}/auth/callback`,
    });

    if (error) {
      return {
        success: false,
        message: error.message,
      };
    }

    return {
      success: true,
      message: "Password reset email sent.",
    };
  } catch (error) {
    logger.error("Password reset action failed", error);
    return {
      success: false,
      message: "Unable to send a reset email right now.",
    };
  }
}
