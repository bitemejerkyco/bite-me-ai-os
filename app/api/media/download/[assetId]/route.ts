import { NextResponse } from "next/server";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { normalizeStoragePath, isAbsoluteUrl } from "@/features/media/media-url-resolver";
import { rowBelongsToWorkspace } from "@/features/media/workspace-access";

type RouteContext = {
  params: Promise<{ assetId: string }>;
};

function safeFileName(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 180);
  return cleaned || "media-asset";
}

async function logDownload(
  supabase: Awaited<ReturnType<typeof requireWorkspaceContext>>["supabase"],
  row: { id: string; workspace_id: string; file_name: string },
): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user?.id) return;
    await supabase.from("audit_logs").insert({
      workspace_id: row.workspace_id,
      actor_user_id: data.user.id,
      action: "media_download",
      target_type: "media_asset",
      target_id: row.id,
      metadata: {
        fileName: row.file_name,
      },
    });
  } catch {
    // Activity logging must not block downloads.
  }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { assetId } = await context.params;
    const workspaceContext = await requireWorkspaceContext();
    const supabase = workspaceContext.supabase;
    const workspaceId = workspaceContext.workspaceId;

    const { data: row, error } = await supabase
      .from("media_assets")
      .select("id,workspace_id,file_name,storage_path,mime_type")
      .eq("id", assetId)
      .maybeSingle();

    if (error || !row || !rowBelongsToWorkspace(workspaceId, row.workspace_id)) {
      return NextResponse.json(
        { error: "The requested file is missing." },
        { status: 404 },
      );
    }

    await logDownload(supabase, row);

    const storagePath = normalizeStoragePath(String(row.storage_path || ""));
    if (!storagePath) {
      return NextResponse.json(
        { error: "The requested file is missing." },
        { status: 404 },
      );
    }

    const fileName = safeFileName(row.file_name || "media-asset");
    const mimeType = row.mime_type || "application/octet-stream";

    if (isAbsoluteUrl(storagePath)) {
      const upstream = await fetch(storagePath, { cache: "no-store" });
      if (!upstream.ok || !upstream.body) {
        return NextResponse.json(
          { error: "The requested file is missing." },
          { status: 404 },
        );
      }
      return new NextResponse(upstream.body, {
        status: 200,
        headers: {
          "cache-control": "private, no-store",
          "content-type": upstream.headers.get("content-type") || mimeType,
          "content-disposition": `attachment; filename=\"${fileName}\"`,
          "x-content-type-options": "nosniff",
        },
      });
    }

    const downloadFromSignedStorage = async () => {
      const signedAttempt = await supabase.storage
        .from("brand-media")
        .createSignedUrl(storagePath, 120);

      if (signedAttempt.error || !signedAttempt.data?.signedUrl) {
        return null;
      }

      const first = await fetch(signedAttempt.data.signedUrl, { cache: "no-store" });
      if (first.ok && first.body) return first;

      if (first.status !== 401 && first.status !== 403) {
        return first;
      }

      const retryAttempt = await supabase.storage
        .from("brand-media")
        .createSignedUrl(storagePath, 120);

      if (retryAttempt.error || !retryAttempt.data?.signedUrl) {
        return first;
      }

      return fetch(retryAttempt.data.signedUrl, { cache: "no-store" });
    };

    const upstream = await downloadFromSignedStorage();
    if (!upstream?.ok || !upstream.body) {
      return NextResponse.json(
        { error: "The requested file is missing." },
        { status: 404 },
      );
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "cache-control": "private, no-store",
        "content-type": upstream.headers.get("content-type") || mimeType,
        "content-disposition": `attachment; filename=\"${fileName}\"`,
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to download this file." },
      { status: 500 },
    );
  }
}
