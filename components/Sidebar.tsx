import { getViewerContext } from "@/lib/auth/server";
import SidebarClient from "@/components/SidebarClient";

export default async function Sidebar() {
  const viewer = await getViewerContext();

  return (
    <SidebarClient
      primaryAccountName={viewer.primaryAccountName}
      viewerEmail={viewer.email}
      showAdminSection={viewer.isSuperAdmin}
    />
  );
}
