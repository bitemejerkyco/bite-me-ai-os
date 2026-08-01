import Link from "next/link";
import AdminSearchForm from "@/components/admin/AdminSearchForm";
import AdminTable from "@/components/admin/AdminTable";
import EmptyState from "@/components/admin/EmptyState";
import { listAdminAccounts } from "@/features/admin/console";

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const result = await listAdminAccounts({
    search: query.search,
    accountType: query.accountType,
    planKey: query.planKey,
    billingStatus: query.billingStatus,
    status: query.status,
    sort: query.sort,
    page: Number(query.page || 1),
    pageSize: Number(query.pageSize || 10),
  });

  return (
    <div className="space-y-6">
      <section className="pm-glass rounded-[2rem] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">
          Accounts
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
          Customer account management
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Search, filter, and open account details for plan, billing, entitlement,
          and usage operations.
        </p>
      </section>

      <AdminSearchForm
        fields={[
          { name: "search", label: "Search", defaultValue: query.search },
          { name: "accountType", label: "Account type", defaultValue: query.accountType },
          { name: "planKey", label: "Plan", defaultValue: query.planKey },
          { name: "billingStatus", label: "Billing status", defaultValue: query.billingStatus },
          {
            name: "status",
            label: "Status",
            defaultValue: query.status,
            options: [
              { value: "active", label: "Active" },
              { value: "suspended", label: "Suspended" },
              { value: "trial", label: "Trial" },
              { value: "paid", label: "Paid" },
              { value: "billing_exempt", label: "Billing exempt" },
            ],
          },
          {
            name: "sort",
            label: "Sort",
            defaultValue: query.sort,
            options: [
              { value: "newest", label: "Newest" },
              { value: "oldest", label: "Oldest" },
              { value: "most_active", label: "Most active" },
              { value: "highest_usage", label: "Highest usage" },
            ],
          },
        ]}
      />

      <AdminTable
        headers={[
          "Account name",
          "Account type",
          "Plan",
          "Billing status",
          "Billing exempt",
          "Member count",
          "AI usage",
          "Video usage",
          "Storage usage",
          "Created",
          "Last activity",
          "Status",
        ]}
        emptyState={
          result.items.length === 0 ? (
            <EmptyState
              title="No accounts matched"
              description="Try loosening the current filters or create customer workspaces through onboarding."
            />
          ) : undefined
        }
      >
        {result.items.map((account) => (
          <tr key={account.id} className="align-top">
            <td className="px-4 py-4">
              <Link className="font-semibold text-violet-700 underline" href={`/admin/accounts/${account.id}`}>
                {account.name}
              </Link>
            </td>
            <td className="px-4 py-4">{account.accountTypeLabel}</td>
            <td className="px-4 py-4">{account.planName}</td>
            <td className="px-4 py-4">{account.billingStatus}</td>
            <td className="px-4 py-4">{account.billingExempt ? "Yes" : "No"}</td>
            <td className="px-4 py-4">{account.memberCount}</td>
            <td className="px-4 py-4">{account.aiUsage}</td>
            <td className="px-4 py-4">{account.videoUsage}</td>
            <td className="px-4 py-4">{Math.round(account.storageUsage / 1048576)} MB</td>
            <td className="px-4 py-4">{new Date(account.createdAt).toLocaleDateString()}</td>
            <td className="px-4 py-4">{new Date(account.lastActivity).toLocaleString()}</td>
            <td className="px-4 py-4">{account.status}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}