import { redirect } from "next/navigation";

export default async function ContentLibraryAliasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const statusRaw = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = String(statusRaw || "").trim().toLowerCase();
  const draft = Array.isArray(params.draft) ? params.draft[0] : params.draft;
  const edit = Array.isArray(params.edit) ? params.edit[0] : params.edit;
  const duplicate = Array.isArray(params.duplicate) ? params.duplicate[0] : params.duplicate;

  const next = new URLSearchParams();
  if (status === "approved") {
    next.set("tab", "APPROVED");
  } else {
    next.set("tab", "CONTENT_DRAFTS");
  }
  if (draft) next.set("draft", String(draft));
  if (edit === "true") next.set("edit", "true");
  if (duplicate === "true") next.set("duplicate", "true");

  redirect(`/media?${next.toString()}`);
}
