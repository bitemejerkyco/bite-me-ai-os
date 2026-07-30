import Link from "next/link";
import AdminSearchForm from "@/components/admin/AdminSearchForm";
import AdminTable from "@/components/admin/AdminTable";
import EmptyState from "@/components/admin/EmptyState";
import { listAdminUsers } from "@/features/admin/console";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const result = await listAdminUsers({
    search: query.search,
    systemRole: query.systemRole,
    membershipRole: query.membershipRole,
    accountId: query.accountId,
    activity: query.activity,
    page: Number(query.page || 1),
    pageSize: Number(query.pageSize || 10),
  });

  return (
    <div className="space-y-6">
      <section className="pm-glass rounded-[2rem] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">
          Users
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
          User and membership management
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Search users, inspect sign-in activity, and manage system roles and account memberships.
        </p>
      </section>

      <AdminSearchForm
        fields={[
          { name: "search", label: "Search", defaultValue: query.search },
          { name: "systemRole", label: "System role", defaultValue: query.systemRole },
          { name: "membershipRole", label: "Membership role", defaultValue: query.membershipRole },
          { name: "accountId", label: "Account", defaultValue: query.accountId },
          {
            name: "activity",
            label: "Activity",
            defaultValue: query.activity,
            options: [
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ],
          },
        ]}
      />

      <AdminTable
        headers={[
          "User",
          "Email",
          "System role",
          "Account memberships",
          "Created",
          "Last sign-in",
          "Status",
        ]}
        emptyState={
          result.items.length === 0 ? (
            <EmptyState title="No users matched" description="Adjust the current filters or onboard more accounts." />
          ) : undefined
        }
      >
        {result.items.map((user) => (
          <tr key={user.id} className="align-top">
            <td className="px-4 py-4">
              <Link className="font-semibold text-violet-700 underline" href={`/admin/users/${user.id}`}>
                {user.fullName}
              </Link>
            </td>
            <td className="px-4 py-4">{user.email}</td>
            <td className="px-4 py-4">{user.systemRole}</td>
            <td className="px-4 py-4">
              {user.memberships.length > 0
                ? user.memberships.map((membership) => membership.accountName).join(", ")
                : "None"}
            </td>
            <td className="px-4 py-4">{new Date(user.createdAt).toLocaleDateString()}</td>
            <td className="px-4 py-4">{user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString() : "Unknown"}</td>
            <td className="px-4 py-4">{user.lastSignInAt ? "Active" : "Unknown"}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}