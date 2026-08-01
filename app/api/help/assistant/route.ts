import { NextResponse } from "next/server";
import { answerHelpQuestion } from "@/features/help/assistant";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { route?: string; question?: string };
    const route = String(body.route || "/");
    const question = String(body.question || "").trim();
    if (!question) {
      return NextResponse.json({ ok: false, error: "A question is required." }, { status: 400 });
    }
    const data = await answerHelpQuestion({ route, question });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
