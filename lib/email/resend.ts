import "server-only";

import { Resend } from "resend";

export function createResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey === "re_xxxxxxxxx") {
    throw new Error(
      "RESEND_NOT_CONFIGURED:Add your real RESEND_API_KEY to the deployment environment.",
    );
  }

  return new Resend(apiKey);
}

export function getResendFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
}
