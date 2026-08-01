import { NextResponse } from "next/server";
import { loadHelpPreference, saveHelpPreference } from "@/features/help/server";

export async function GET() {
  try {
    const data = await loadHelpPreference();
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      helpMode?: "ON" | "OFF" | "AUTO";
      compactPanels?: boolean;
      proactiveTrainerEnabled?: boolean;
    };
    const helpMode = body.helpMode === "ON" || body.helpMode === "OFF" ? body.helpMode : "AUTO";
    await saveHelpPreference({
      helpMode,
      compactPanels: Boolean(body.compactPanels),
      proactiveTrainerEnabled: body.proactiveTrainerEnabled !== false,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
