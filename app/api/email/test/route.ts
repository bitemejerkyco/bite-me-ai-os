import { NextResponse } from "next/server";
import { getViewerContext } from "@/lib/auth/server";
import {
  createResendClient,
  getResendFromEmail,
} from "@/lib/email/resend";

const TEST_RECIPIENT = "khyatt38@gmail.com";

export async function POST() {
  const viewer = await getViewerContext();

  if (!viewer.userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  if (!viewer.isSuperAdmin) {
    return NextResponse.json({ error: "Super-admin access required." }, { status: 403 });
  }

  try {
    const resend = createResendClient();
    const { data, error } = await resend.emails.send({
      from: getResendFromEmail(),
      to: TEST_RECIPIENT,
      subject: "Hello World",
      html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
    });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Resend could not send the email." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, emailId: data?.id || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email could not be sent.";
    const status = message.startsWith("RESEND_NOT_CONFIGURED:") ? 503 : 500;

    return NextResponse.json(
      { error: message.replace("RESEND_NOT_CONFIGURED:", "") },
      { status },
    );
  }
}
