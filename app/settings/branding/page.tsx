import Sidebar from "@/components/Sidebar";
import PageHelpPanel from "@/components/help/PageHelpPanel";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { saveBrandingSettingsAction } from "@/app/settings/branding/actions";

type BrandingRow = {
  logo_url?: string | null;
  primary_color?: string | null;
  custom_domain?: string | null;
  email_branding_name?: string | null;
  login_headline?: string | null;
  favicon_url?: string | null;
};

export default async function BrandingSettingsPage() {
  const context = await requireWorkspaceContext();
  const { supabase, workspaceId, workspaceName } = context;

  const { data } = await supabase
    .from("workspace_branding_settings")
    .select("logo_url,primary_color,custom_domain,email_branding_name,login_headline,favicon_url")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const branding = (data as BrandingRow | null) || null;

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 md:flex-row">
      <Sidebar />
      <div className="flex-1 p-5 md:p-10">
        <PageHelpPanel />
        <section className="pm-glass rounded-[2rem] border border-white/90 bg-white/80 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Branding</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">White-label workspace controls</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Apply custom logo, color, domain, and login messaging for {workspaceName}. Existing flows remain unchanged.
          </p>
        </section>

        <form action={saveBrandingSettingsAction} className="mt-6 space-y-4 rounded-[2rem] border border-slate-200/90 bg-white/90 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-800">
              Logo URL
              <input
                name="logoUrl"
                defaultValue={branding?.logo_url || ""}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"
                placeholder="https://cdn.example.com/logo.png"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Favicon URL
              <input
                name="faviconUrl"
                defaultValue={branding?.favicon_url || ""}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"
                placeholder="https://cdn.example.com/favicon.ico"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Primary color
              <input
                name="primaryColor"
                defaultValue={branding?.primary_color || ""}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"
                placeholder="#5b3df5"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Custom domain
              <input
                name="customDomain"
                defaultValue={branding?.custom_domain || ""}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"
                placeholder="brand.example.com"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Email sender name
              <input
                name="emailBrandingName"
                defaultValue={branding?.email_branding_name || ""}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"
                placeholder="PostMotive by Acme"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Login headline
              <input
                name="loginHeadline"
                defaultValue={branding?.login_headline || ""}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"
                placeholder="Welcome to the Acme marketing command center"
              />
            </label>
          </div>

          <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Domain verification and custom email DNS checks are tracked operationally and can be staged without disrupting current login behavior.
          </p>

          <button type="submit" className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500">
            Save branding settings
          </button>
        </form>
      </div>
    </div>
  );
}
