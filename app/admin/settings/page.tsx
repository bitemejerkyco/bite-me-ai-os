import AdminMutationForm from "@/components/admin/AdminMutationForm";
import AdminNotice from "@/components/admin/AdminNotice";
import AdminTable from "@/components/admin/AdminTable";
import EmptyState from "@/components/admin/EmptyState";
import { updateSystemSettingAction } from "@/app/admin/actions";
import { loadAdminSettingsPageData } from "@/features/admin/console";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const query = await searchParams;
  const settings = await loadAdminSettingsPageData();

  return (
    <div className="space-y-6">
      <AdminNotice notice={query.notice} error={query.error} />

      <section className="pm-glass rounded-[2rem] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Settings</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Platform settings</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Safe operational settings are editable here. Secret values remain in environment variables or secure vaults.
        </p>
      </section>

      <AdminTable
        headers={["Key", "Category", "Value", "Description", "Updated"]}
        emptyState={settings.length === 0 ? <EmptyState title="No settings found" description="Seeded system settings should appear here once the migration is applied." /> : undefined}
      >
        {settings.map((setting) => (
          <tr key={setting.id} className="align-top">
            <td className="px-4 py-4 font-semibold text-slate-900">{setting.key}</td>
            <td className="px-4 py-4">{setting.category}</td>
            <td className="px-4 py-4 text-xs text-slate-500">{JSON.stringify(setting.value)}</td>
            <td className="px-4 py-4">{setting.description}</td>
            <td className="px-4 py-4">{new Date(setting.updatedAt).toLocaleString()}</td>
          </tr>
        ))}
      </AdminTable>

      <section className="grid gap-4 md:grid-cols-2">
        {settings.map((setting) => (
          <AdminMutationForm
            key={setting.id}
            action={updateSystemSettingAction}
            title={`Edit ${setting.key}`}
            description={setting.description}
            hiddenFields={[
              { name: "key", value: setting.key },
              { name: "returnPath", value: "/admin/settings" },
            ]}
            buttonLabel="Save setting"
          >
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Value
              <textarea
                name="value"
                defaultValue={typeof setting.value === "string" ? setting.value : JSON.stringify(setting.value)}
                className="mt-2 h-28 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
              />
            </label>
          </AdminMutationForm>
        ))}
      </section>
    </div>
  );
}