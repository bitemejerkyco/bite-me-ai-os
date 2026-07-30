import AdminSearchForm from "@/components/admin/AdminSearchForm";
import AdminTable from "@/components/admin/AdminTable";
import EmptyState from "@/components/admin/EmptyState";
import { listAdminAuditLogs } from "@/features/admin/console";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const result = await listAdminAuditLogs({
    search: query.search,
    actor: query.actor,
    targetAccountId: query.targetAccountId,
    action: query.action,
    resourceType: query.resourceType,
    from: query.from,
    to: query.to,
    page: Number(query.page || 1),
    pageSize: Number(query.pageSize || 20),
  });

  return (
    <div className="space-y-6">
      <section className="pm-glass rounded-[2rem] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">
          Audit Log
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
          Append-only admin audit log
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Sensitive values are sanitized before write and the log remains append-only.
        </p>
      </section>

      <AdminSearchForm
        fields={[
          { name: "search", label: "Search", defaultValue: query.search },
          { name: "actor", label: "Actor", defaultValue: query.actor },
          { name: "targetAccountId", label: "Target account", defaultValue: query.targetAccountId },
          { name: "action", label: "Action", defaultValue: query.action },
          { name: "resourceType", label: "Resource type", defaultValue: query.resourceType },
          { name: "from", label: "From", defaultValue: query.from },
          { name: "to", label: "To", defaultValue: query.to },
        ]}
      />

      <AdminTable
        headers={["Timestamp", "Actor", "Target account", "Action", "Resource", "Previous value", "New value", "Reason"]}
        emptyState={result.items.length === 0 ? <EmptyState title="No audit events" description="Admin mutations will appear here once the console is used." /> : undefined}
      >
        {result.items.map((row) => (
          <tr key={String(row.id)} className="align-top">
            <td className="px-4 py-4">{new Date(String(row.created_at)).toLocaleString()}</td>
            <td className="px-4 py-4">{String(row.actor_user_id || "Unknown")}</td>
            <td className="px-4 py-4">{String(row.target_account_id || "Global")}</td>
            <td className="px-4 py-4">{String(row.action)}</td>
            <td className="px-4 py-4">{String(row.resource_type)} {row.resource_id ? `· ${String(row.resource_id)}` : ""}</td>
            <td className="px-4 py-4 text-xs text-slate-500">{JSON.stringify(row.previous_value)}</td>
            <td className="px-4 py-4 text-xs text-slate-500">{JSON.stringify(row.new_value)}</td>
            <td className="px-4 py-4">{String(row.reason || "No reason recorded")}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}