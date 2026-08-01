import type { ReactNode } from "react";

export default function AdminTable({
  headers,
  children,
  emptyState,
}: {
  headers: string[];
  children: ReactNode;
  emptyState?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[2rem] border border-white/90 bg-white/80 shadow-[0_18px_45px_rgba(76,61,139,0.08)]">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm text-slate-700">
          <thead className="bg-slate-50/90 text-left text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">{children}</tbody>
        </table>
      </div>
      {emptyState ? <div className="border-t border-slate-100 px-4 py-5 text-sm text-slate-500">{emptyState}</div> : null}
    </div>
  );
}