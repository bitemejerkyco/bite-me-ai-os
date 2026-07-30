import AdminSearchForm from "@/components/admin/AdminSearchForm";
import MetricCard from "@/components/admin/MetricCard";
import AdminTable from "@/components/admin/AdminTable";
import EmptyState from "@/components/admin/EmptyState";
import { loadAdminCostsPageData } from "@/features/admin/console";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export default async function AdminCostsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const data = await loadAdminCostsPageData({
    from: query.from,
    to: query.to,
    provider: query.provider,
    model: query.model,
    accountId: query.accountId,
    feature: query.feature,
    status: query.status,
  });

  return (
    <div className="space-y-6">
      <section className="pm-glass rounded-[2rem] p-6">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-violet-600">AI Costs</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">AI cost center</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Estimated versus actual cost uses configured rates where available and labels missing-rate gaps explicitly.
        </p>
      </section>

      <AdminSearchForm
        fields={[
          { name: "from", label: "From", defaultValue: query.from },
          { name: "to", label: "To", defaultValue: query.to },
          { name: "provider", label: "Provider", defaultValue: query.provider },
          { name: "model", label: "Model", defaultValue: query.model },
          { name: "accountId", label: "Account", defaultValue: query.accountId },
          { name: "feature", label: "Feature", defaultValue: query.feature },
          { name: "status", label: "Status", defaultValue: query.status },
        ]}
      />

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard eyebrow="Cost" title="Total cost" value={formatMoney(data.totalCostCents)} detail="Estimated and actual costs combined." />
        <MetricCard eyebrow="Revenue" title="Revenue allocated" value={formatMoney(data.totalRevenueAllocatedCents)} detail="Uses synchronized allocation fields only." />
        <MetricCard eyebrow="Margin" title="Gross margin" value={formatMoney(data.grossMarginCents)} detail="Revenue allocated minus tracked costs." />
        <MetricCard eyebrow="Refunds" title="Credits refunded" value={String(data.creditsRefunded)} detail="Refunded video credits from tracked transactions." />
        <MetricCard eyebrow="Missing rates" title="Rate gaps" value={String(data.aiSummary.missingRateEvents)} detail="Events without configured rate coverage." tone={data.aiSummary.missingRateEvents > 0 ? "warning" : "default"} />
      </section>

      <AdminTable
        headers={["Provider", "Model", "Operation", "Status", "Credits", "Estimated cost", "Actual cost", "Revenue", "Duration", "Created"]}
        emptyState={data.events.length === 0 ? <EmptyState title="No AI usage events" description="AI usage events will appear here once tracked operations are written to the ledger." /> : undefined}
      >
        {data.events.map((event, index) => (
          <tr key={`${event.provider}-${event.model}-${event.createdAt}-${index}`} className="align-top">
            <td className="px-4 py-4">{event.provider}</td>
            <td className="px-4 py-4">{event.model}</td>
            <td className="px-4 py-4">{event.operation}</td>
            <td className="px-4 py-4">{event.status}</td>
            <td className="px-4 py-4">{event.creditsCharged}</td>
            <td className="px-4 py-4">{formatMoney(event.estimatedCostCents)}</td>
            <td className="px-4 py-4">{event.actualCostCents === null ? "Rate not configured" : formatMoney(event.actualCostCents)}</td>
            <td className="px-4 py-4">{event.revenueAllocatedCents === null ? "Unallocated" : formatMoney(event.revenueAllocatedCents)}</td>
            <td className="px-4 py-4">{event.durationMs ?? "Unknown"}</td>
            <td className="px-4 py-4">{new Date(event.createdAt).toLocaleString()}</td>
          </tr>
        ))}
      </AdminTable>
    </div>
  );
}