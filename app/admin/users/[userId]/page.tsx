import AdminMutationForm from "@/components/admin/AdminMutationForm";
import AdminNotice from "@/components/admin/AdminNotice";
import EmptyState from "@/components/admin/EmptyState";
import MetricCard from "@/components/admin/MetricCard";
import {
  addUserToAccountAction,
  assignInternalAdminAction,
  assignSupportAdminAction,
  changeMembershipRoleAction,
  grantSuperAdminAction,
  removeSuperAdminAction,
  removeUserFromAccountAction,
  returnToStandardUserAction,
} from "@/app/admin/actions";
import { getAdminUserDetail, listAdminAccounts } from "@/features/admin/console";

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const { userId } = await params;
  const query = await searchParams;
  const [detail, accounts] = await Promise.all([
    getAdminUserDetail(userId),
    listAdminAccounts({ page: 1, pageSize: 200 }),
  ]);

  return (
    <div className="space-y-6">
      <AdminNotice notice={query.notice} error={query.error} />

      <section className="grid gap-5 lg:grid-cols-4">
        <MetricCard eyebrow="User" title={detail.user.fullName} value={detail.user.systemRole} detail={detail.user.email} />
        <MetricCard eyebrow="Memberships" title="Accounts" value={String(detail.memberships.length)} detail="Workspace memberships" />
        <MetricCard eyebrow="Joined" title="Created" value={new Date(detail.user.createdAt).toLocaleDateString()} detail="Profile creation date" />
        <MetricCard eyebrow="Activity" title="Last sign-in" value={detail.user.lastSignInAt ? new Date(detail.user.lastSignInAt).toLocaleDateString() : "Unknown"} detail="Last sign-in when available" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <article className="pm-glass rounded-[2rem] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Profile</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Profile details</h2>
            <dl className="mt-5 grid gap-4 md:grid-cols-2 text-sm text-slate-700">
              <div>
                <dt className="font-semibold text-slate-500">Name</dt>
                <dd className="mt-1">{detail.user.fullName}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Email</dt>
                <dd className="mt-1">{detail.user.email}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">System role</dt>
                <dd className="mt-1">{detail.user.systemRole}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-500">Last sign-in</dt>
                <dd className="mt-1">{detail.user.lastSignInAt ? new Date(detail.user.lastSignInAt).toLocaleString() : "Unknown"}</dd>
              </div>
            </dl>
          </article>

          <article className="pm-glass rounded-[2rem] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Memberships</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Account memberships</h2>
            <div className="mt-5 space-y-3">
              {detail.memberships.length > 0 ? (
                detail.memberships.map((membership) => (
                  <div key={membership.id} className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{membership.accountName}</p>
                        <p className="text-sm text-slate-500">{membership.role}</p>
                      </div>
                      <div className="text-xs text-slate-500">{membership.status}</div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState title="No memberships yet" description="This user is not assigned to any accounts yet." />
              )}
            </div>
          </article>

          <article className="pm-glass rounded-[2rem] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">Recent activity</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Activity and admin actions</h2>
            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <div className="space-y-3">
                {detail.recentActivity.map((event, index) => (
                  <div key={`${event.type}-${event.at}-${index}`} className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
                    <p className="text-sm font-semibold text-slate-900">{event.type.replaceAll("_", " ")}</p>
                    <p className="mt-1 text-xs text-slate-500">{new Date(event.at).toLocaleString()}</p>
                    <p className="mt-2 text-sm text-slate-600">{event.detail}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {detail.auditActions.map((event) => (
                  <div key={String(event.id)} className="rounded-[1.4rem] border border-slate-200 bg-white/80 p-4">
                    <p className="text-sm font-semibold text-slate-900">{String(event.action)}</p>
                    <p className="mt-1 text-xs text-slate-500">{new Date(String(event.created_at)).toLocaleString()}</p>
                    <p className="mt-2 text-sm text-slate-600">{String(event.reason || "No reason recorded")}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>

        <aside className="space-y-4">
          <AdminMutationForm
            action={grantSuperAdminAction}
            title="Grant Super Admin"
            description="Assigns global Super Admin access to this user."
            hiddenFields={[
              { name: "userId", value: userId },
              { name: "returnPath", value: `/admin/users/${userId}` },
            ]}
            buttonLabel="Grant Super Admin"
          />

          <AdminMutationForm
            action={removeSuperAdminAction}
            title="Remove Super Admin"
            description="Will be blocked if this user is the final active Super Admin removing their own access."
            hiddenFields={[
              { name: "userId", value: userId },
              { name: "returnPath", value: `/admin/users/${userId}` },
            ]}
            buttonLabel="Remove Super Admin"
          />

          <AdminMutationForm
            action={assignInternalAdminAction}
            title="Assign Internal Admin"
            description="Assigns the internal operations role to this user."
            hiddenFields={[
              { name: "userId", value: userId },
              { name: "returnPath", value: `/admin/users/${userId}` },
            ]}
            buttonLabel="Assign Internal Admin"
          />

          <AdminMutationForm
            action={assignSupportAdminAction}
            title="Assign Support Admin"
            description="Assigns the support operations role to this user."
            hiddenFields={[
              { name: "userId", value: userId },
              { name: "returnPath", value: `/admin/users/${userId}` },
            ]}
            buttonLabel="Assign Support Admin"
          />

          <AdminMutationForm
            action={returnToStandardUserAction}
            title="Return to standard user"
            description="Removes any elevated system role from this profile."
            hiddenFields={[
              { name: "userId", value: userId },
              { name: "returnPath", value: `/admin/users/${userId}` },
            ]}
            buttonLabel="Return to standard user"
          />

          <AdminMutationForm
            action={addUserToAccountAction}
            title="Add user to account"
            description="Creates or reactivates a membership for this user."
            hiddenFields={[
              { name: "userId", value: userId },
              { name: "returnPath", value: `/admin/users/${userId}` },
            ]}
            buttonLabel="Add to account"
          >
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Account
              <select name="accountId" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                {accounts.items.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Membership role
              <select name="role" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                <option value="MEMBER">MEMBER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                <option value="DEMO">DEMO</option>
              </select>
            </label>
          </AdminMutationForm>

          {detail.memberships.map((membership) => (
            <div key={membership.id} className="space-y-4">
              <AdminMutationForm
                action={changeMembershipRoleAction}
                title={`Change role for ${membership.accountName}`}
                description="Updates the membership role for this account."
                hiddenFields={[
                  { name: "userId", value: userId },
                  { name: "accountId", value: membership.workspace_id },
                  { name: "returnPath", value: `/admin/users/${userId}` },
                ]}
                buttonLabel="Change membership role"
              >
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Membership role
                  <select name="role" defaultValue={membership.role} className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
                    <option value="MEMBER">MEMBER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    <option value="DEMO">DEMO</option>
                  </select>
                </label>
              </AdminMutationForm>

              <AdminMutationForm
                action={removeUserFromAccountAction}
                title={`Remove from ${membership.accountName}`}
                description="Removes this user's membership from the account."
                hiddenFields={[
                  { name: "userId", value: userId },
                  { name: "accountId", value: membership.workspace_id },
                  { name: "returnPath", value: `/admin/users/${userId}` },
                ]}
                buttonLabel="Remove from account"
              />
            </div>
          ))}
        </aside>
      </section>
    </div>
  );
}