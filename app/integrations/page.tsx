import Link from "next/link";
import AppShell from "@/components/AppShell";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";

export default async function IntegrationsPage() {
  const context = await requireWorkspaceContext();
  const admin = createAdminClient();

  const [tiktok, amazonSetting] = await Promise.all([
    admin.from("tiktok_connections").select("status,updated_at").eq("workspace_id", context.workspaceId).maybeSingle(),
    admin.from("system_settings").select("key").eq("key", "amazon_ads_live_enabled").maybeSingle(),
  ]);

  const tiktokRow = (tiktok.data as { status?: string | null } | null) || null;
  const amazonSettingRow = (amazonSetting.data as { key?: string | null } | null) || null;

  const tiktokStatus = tiktokRow?.status || "DISCONNECTED";
  const amazonConfigured = Boolean(amazonSettingRow?.key);

  return (
    <AppShell title="Integrations" eyebrow="Connected channels and data sources">
      <section className="pm-glass rounded-[2rem] border border-white/90 bg-white/80 p-6">
        <h2 className="text-2xl font-black tracking-tight text-slate-900">Channel and analytics connections</h2>
        <p className="mt-2 text-sm text-slate-600">
          Connect data sources to improve Marketing Score confidence, revenue visibility, and action recommendations.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white/85 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">TikTok</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{String(tiktokStatus).replaceAll("_", " ")}</p>
            <p className="mt-2 text-sm text-slate-600">Required for upload-to-draft workflows and connected social execution data.</p>
            <Link href="/settings/integrations/tiktok" className="mt-3 inline-flex rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50">
              Manage TikTok
            </Link>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white/85 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Amazon Ads</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{amazonConfigured ? "Configured" : "Not configured"}</p>
            <p className="mt-2 text-sm text-slate-600">Improves paid media health and revenue-oriented recommendations when connected.</p>
            <Link href="/settings/integrations/amazon-ads" className="mt-3 inline-flex rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50">
              Manage Amazon Ads
            </Link>
          </article>
        </div>
      </section>
    </AppShell>
  );
}
