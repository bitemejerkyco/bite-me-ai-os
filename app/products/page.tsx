import AppShell from "@/components/AppShell";
import GuidedEmptyState from "@/components/help/GuidedEmptyState";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceContext } from "@/features/marketing-director/workspace-context";
import { detectProductsTable } from "@/features/marketing-director/data-coverage";

export default async function ProductsPage() {
  const context = await requireWorkspaceContext();
  const admin = createAdminClient();
  const hasProductsTable = await detectProductsTable();
  const count = hasProductsTable
    ? Number((await admin.from("products").select("id", { count: "exact", head: true }).eq("workspace_id", context.workspaceId)).count || 0)
    : 0;

  return (
    <AppShell title="Products and Product Setup" eyebrow="Product-aware marketing context">
      <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6">
        {hasProductsTable ? (
          <div className="space-y-3">
            <p className="text-sm leading-6 text-slate-600">
              This environment supports product records. Product-aware AI guidance improves when the catalog is populated.
            </p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-sm font-semibold text-slate-900">Available product records</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{count}</p>
            </div>
            {count === 0 ? <GuidedEmptyState title="No products or services added" description="Add products so PostMotive can generate product-specific campaigns, promotions, and content." estimatedTime="3-5 minutes" primaryAction={{ label: "Add Product", href: "/products" }} secondaryAction={{ label: "Import CSV", href: "/help" }} /> : null}
          </div>
        ) : (
          <GuidedEmptyState title="No products or services added" description="Add products so PostMotive can generate product-specific campaigns, promotions, and content." estimatedTime="3-5 minutes" primaryAction={{ label: "Add Product", href: "/products" }} secondaryAction={{ label: "Import CSV", href: "/help" }} />
        )}
      </section>
    </AppShell>
  );
}
