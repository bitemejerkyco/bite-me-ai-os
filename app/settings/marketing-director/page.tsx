import Sidebar from "@/components/Sidebar";
import { getMarketingModeSettings } from "@/features/marketing-director/modes";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { saveMarketingDirectorSettingsAction } from "@/app/settings/marketing-director/actions";

export default async function MarketingDirectorSettingsPage() {
  const context = await requireWorkspaceContext();
  const settings = await getMarketingModeSettings(context.workspaceId);

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 md:flex-row">
      <Sidebar />
      <div className="flex-1 p-5 md:p-10">
        <section className="pm-glass rounded-[2rem] border border-white/90 bg-white/80 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Marketing Director settings</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Operating mode and approvals</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Configure how much automation the Marketing Director can propose. Autopilot remains disabled until the feature flag rollout is enabled.
          </p>
        </section>

        <form action={saveMarketingDirectorSettingsAction} className="mt-6 space-y-4 rounded-[2rem] border border-slate-200/90 bg-white/85 p-6">
          <label className="block text-sm font-semibold text-slate-800">
            Operating mode
            <select
              name="operatingMode"
              defaultValue={settings.operatingMode}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"
            >
              <option value="advisor">Advisor (recommendations only)</option>
              <option value="copilot">Copilot (proposal + assisted drafting)</option>
              <option value="autopilot" disabled={!settings.autopilotAvailable}>Autopilot (coming soon)</option>
            </select>
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <input type="checkbox" name="approvalRequiredForContent" defaultChecked={settings.approvalRequiredForContent} />
              Approval required for content
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <input type="checkbox" name="approvalRequiredForScheduling" defaultChecked={settings.approvalRequiredForScheduling} />
              Approval required for scheduling
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <input type="checkbox" name="approvalRequiredForBudgetChanges" defaultChecked={settings.approvalRequiredForBudgetChanges} />
              Approval required for budget changes
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <input type="checkbox" name="approvalRequiredForPublishing" defaultChecked={settings.approvalRequiredForPublishing} />
              Approval required for publishing
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block text-sm font-semibold text-slate-800">
              Daily brief enabled
              <select
                name="dailyBriefEnabled"
                defaultValue={settings.dailyBriefEnabled ? "true" : "false"}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Daily brief time
              <input
                type="time"
                name="dailyBriefTime"
                defaultValue={settings.dailyBriefTime}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              Timezone
              <input
                name="timezone"
                defaultValue={settings.timezone}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800"
                placeholder="UTC"
              />
            </label>
          </div>

          <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            {settings.autopilotMessage}
          </p>

          <button type="submit" className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500">
            Save settings
          </button>
        </form>
      </div>
    </div>
  );
}
